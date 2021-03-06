import { localForger } from '@taquito/local-forging'
import * as sodium from 'libsodium-wrappers'

import axios, { AxiosError, AxiosResponse } from '../../dependencies/src/axios-0.19.0/index'
import BigNumber from '../../dependencies/src/bignumber.js-9.0.0/bignumber'
import * as bs58check from '../../dependencies/src/bs58check-2.1.2/index'
import { generateWalletUsingDerivationPath } from '../../dependencies/src/hd-wallet-js-b216450e56954a6e82ace0aade9474673de5d9d5/src/index'
import { IAirGapSignedTransaction } from '../../interfaces/IAirGapSignedTransaction'
import { IAirGapTransaction } from '../../interfaces/IAirGapTransaction'
import { UnsignedTezosTransaction } from '../../serializer/schemas/definitions/transaction-sign-request-tezos'
import { SignedTezosTransaction } from '../../serializer/schemas/definitions/transaction-sign-response-tezos'
import { RawTezosTransaction } from '../../serializer/types'
import { getSubProtocolsByIdentifier } from '../../utils/subProtocols'
import { CurrencyUnit, FeeDefaults } from '../ICoinProtocol'
import { NonExtendedProtocol } from '../NonExtendedProtocol'

import { TezosRewardsCalculation005 } from './rewardcalculation/TezosRewardCalculation005'
import { TezosRewardsCalculation006 } from './rewardcalculation/TezosRewardCalculation006'
import { TezosRewardsCalculationDefault } from './rewardcalculation/TezosRewardCalculationDefault'
import { TezosDelegationOperation } from './types/operations/Delegation'
import { TezosOriginationOperation } from './types/operations/Origination'
import { TezosRevealOperation } from './types/operations/Reveal'
import { TezosOperation } from './types/operations/TezosOperation'
import { TezosTransactionOperation } from './types/operations/Transaction'
import { TezosOperationType } from './types/TezosOperationType'
import { TezosWrappedOperation } from './types/TezosWrappedOperation'
import { mnemonicToSeed } from '../../dependencies/src/bip39-2.5.0/index'
import { ICoinDelegateProtocol, DelegatorAction, DelegationDetails, DelegateeDetails } from '../ICoinDelegateProtocol'
import { isArray } from 'util'

const assertNever: (x: never) => void = (x: never): void => undefined

const MAX_OPERATIONS_PER_GROUP: number = 200

export interface TezosVotingInfo {
  pkh: string
  rolls: number
}

export interface BakerInfo {
  balance: BigNumber
  delegatedBalance: BigNumber
  stakingBalance: BigNumber
  bakingActive: boolean
  selfBond: BigNumber
  bakerCapacity: BigNumber
  bakerUsage: BigNumber
}

export interface DelegationRewardInfo {
  cycle: number
  reward: BigNumber
  deposit: BigNumber
  delegatedBalance: BigNumber
  stakingBalance: BigNumber
  totalRewards: BigNumber
  totalFees: BigNumber
  payout: Date
}

export interface DelegationInfo {
  isDelegated: boolean
  value?: string
  delegatedOpLevel?: number
  delegatedDate?: Date
}

export enum TezosDelegatorAction {
  DELEGATE = 'delegate',
  UNDELEGATE = 'undelegate',
  CHANGE_BAKER = 'change_baker'
}

export interface TezosPayoutInfo {
  delegator: string
  share: string
  payout: string
}

// 8.25%
const SELF_BOND_REQUIREMENT: number = 0.0825

export enum TezosNetwork {
  MAINNET = 'mainnet',
  BABYLONNET = 'babylonnet',
  CARTHAGENET = 'carthagenet'
}

export class TezosProtocol extends NonExtendedProtocol implements ICoinDelegateProtocol {
  public symbol: string = 'XTZ'
  public name: string = 'Tezos'
  public marketSymbol: string = 'xtz'
  public feeSymbol: string = 'xtz'

  public decimals: number = 6
  public feeDecimals: number = 6 // micro tez is the smallest, 1000000 microtez is 1 tez
  public identifier: string = 'xtz'

  get subProtocols() {
    return getSubProtocolsByIdentifier(this.identifier) as any[] // TODO: Fix typings once apps are compatible with 3.7
  }

  // tezbox default
  public feeDefaults: FeeDefaults = {
    low: '0.001420',
    medium: '0.001520',
    high: '0.003000'
  }

  public units: CurrencyUnit[] = [
    {
      unitSymbol: 'XTZ',
      factor: '1'
    }
  ]

  public supportsHD: boolean = false
  public standardDerivationPath: string = `m/44h/1729h/0h/0h`

  public addressIsCaseSensitive: boolean = true
  public addressValidationPattern: string = '^(tz1|KT1)[1-9A-Za-z]{33}$'
  public addressPlaceholder: string = 'tz1...'

  public blockExplorer: string = 'https://tezblock.io'

  protected readonly transactionFee: BigNumber = new BigNumber('1400')
  protected readonly originationSize: BigNumber = new BigNumber('257')
  protected readonly storageCostPerByte: BigNumber = new BigNumber('1000')

  protected readonly revealFee: BigNumber = new BigNumber('1300')
  protected readonly activationBurn: BigNumber = this.originationSize.times(this.storageCostPerByte)
  protected readonly originationBurn: BigNumber = this.originationSize.times(this.storageCostPerByte) // https://tezos.stackexchange.com/a/787

  // Tezos - We need to wrap these in Buffer due to non-compatible browser polyfills
  protected readonly tezosPrefixes: {
    tz1: Buffer
    tz2: Buffer
    tz3: Buffer
    kt: Buffer
    edpk: Buffer
    edsk: Buffer
    edsig: Buffer
    branch: Buffer
  } = {
      tz1: Buffer.from(new Uint8Array([6, 161, 159])),
      tz2: Buffer.from(new Uint8Array([6, 161, 161])),
      tz3: Buffer.from(new Uint8Array([6, 161, 164])),
      kt: Buffer.from(new Uint8Array([2, 90, 121])),
      edpk: Buffer.from(new Uint8Array([13, 15, 37, 217])),
      edsk: Buffer.from(new Uint8Array([43, 246, 78, 7])),
      edsig: Buffer.from(new Uint8Array([9, 245, 205, 134, 18])),
      branch: Buffer.from(new Uint8Array([1, 52]))
    }

  public readonly headers = { 'Content-Type': 'application/json', apiKey: 'airgap123' }

  /**
   * Tezos Implemention of ICoinProtocol
   */
  constructor(
    public jsonRPCAPI: string = 'https://tezos-node.prod.gke.papers.tech',
    public baseApiUrl: string = 'https://tezos-mainnet-conseil-1.kubernetes.papers.tech',
    public network: TezosNetwork = TezosNetwork.MAINNET,
    readonly baseApiNetwork: string = network,
    apiKey?: string
  ) {
    super()
    if (apiKey !== undefined) {
      this.headers.apiKey = apiKey
    }
  }

  public async getBlockExplorerLinkForAddress(address: string): Promise<string> {
    return `${this.blockExplorer}/account/{{address}}`.replace('{{address}}', address)
  }

  public async getBlockExplorerLinkForTxId(txId: string): Promise<string> {
    return `${this.blockExplorer}/transaction/{{txId}}`.replace('{{txId}}', txId)
  }

  public async getPublicKeyFromMnemonic(mnemonic: string, derivationPath: string, password?: string): Promise<string> {
    const secret = mnemonicToSeed(mnemonic, password)
    return this.getPublicKeyFromHexSecret(secret, derivationPath)
  }

  public async getPrivateKeyFromMnemonic(mnemonic: string, derivationPath: string, password?: string): Promise<Buffer> {
    const secret = mnemonicToSeed(mnemonic, password)
    return this.getPrivateKeyFromHexSecret(secret, derivationPath)
  }

  /**
   * Returns the PublicKey as String, derived from a supplied hex-string
   * @param secret HEX-Secret from BIP39
   * @param derivationPath DerivationPath for Key
   */
  public async getPublicKeyFromHexSecret(secret: string, derivationPath: string): Promise<string> {
    // both AE and Tezos use the same ECC curves (ed25519)
    const { publicKey }: { publicKey: string } = generateWalletUsingDerivationPath(Buffer.from(secret, 'hex'), derivationPath) as any // TODO: Look into typings

    return Buffer.from(publicKey).toString('hex')
  }

  /**
   * Returns the PrivateKey as Buffer, derived from a supplied hex-string
   * @param secret HEX-Secret from BIP39
   * @param derivationPath DerivationPath for Key
   */
  public async getPrivateKeyFromHexSecret(secret: string, derivationPath: string): Promise<Buffer> {
    // both AE and Tezos use the same ECC curves (ed25519)
    const { secretKey }: { secretKey: string } = generateWalletUsingDerivationPath(Buffer.from(secret, 'hex'), derivationPath) as any // TODO: Look into typings

    return Buffer.from(secretKey)
  }

  public async getAddressFromPublicKey(publicKey: string): Promise<string> {
    await sodium.ready

    const payload: Uint8Array = sodium.crypto_generichash(20, Buffer.from(publicKey, 'hex'))
    const address: string = bs58check.encode(Buffer.concat([this.tezosPrefixes.tz1, Buffer.from(payload)]))

    return address
  }

  public async getAddressesFromPublicKey(publicKey: string): Promise<string[]> {
    const address: string = await this.getAddressFromPublicKey(publicKey)

    return [address]
  }

  public async getTransactionsFromPublicKey(publicKey: string, limit: number, offset: number): Promise<IAirGapTransaction[]> {
    const addresses: string[] = await this.getAddressesFromPublicKey(publicKey)

    return this.getTransactionsFromAddresses(addresses, limit, offset)
  }

  public async getTransactionsFromAddresses(addresses: string[], limit: number, offset: number): Promise<IAirGapTransaction[]> {
    // TODO: implement pagination
    if (offset !== 0) {
      return []
    }
    const allTransactions = await Promise.all(
      addresses.map(address => {
        const getRequestBody = (field: string, set: string) => {
          return {
            predicates: [
              {
                field,
                operation: 'eq',
                set: [address],
                inverse: false
              },
              {
                field: 'kind',
                operation: 'eq',
                set: [set],
                inverse: false
              }
            ],
            orderBy: [
              {
                field: 'block_level',
                direction: 'desc'
              }
            ],
            limit
          }
        }

        return new Promise<any>(async (resolve, reject) => {
          const fromPromise = axios
            .post(`${this.baseApiUrl}/v2/data/tezos/${this.baseApiNetwork}/operations`, getRequestBody('source', 'transaction'), {
              headers: this.headers
            })
            .catch(() => {
              return { data: [] }
            })
          const toPromise = axios
            .post(`${this.baseApiUrl}/v2/data/tezos/${this.baseApiNetwork}/operations`, getRequestBody('destination', 'transaction'), {
              headers: this.headers
            })
            .catch(() => {
              return { data: [] }
            })

          interface ConseilOperation {
            amount: string
            source: string
            destination: string
            operation_group_hash: string
          }

          const [to, from] = await Promise.all([fromPromise, toPromise])
          const transactions: any[] = (to.data.concat(from.data) as ConseilOperation[]).reduce((pv: ConseilOperation[], cv) => {
            // Filter out all duplicates
            if (
              !pv.find(
                (el: ConseilOperation) =>
                  el.amount === cv.amount &&
                  el.source === cv.source &&
                  el.destination === cv.destination &&
                  el.operation_group_hash === cv.operation_group_hash
              )
            ) {
              pv.push(cv)
            }

            return pv
          }, [])
          transactions.sort((a, b) => b.timestamp - a.timestamp)
          transactions.length = Math.min(limit, transactions.length) // Because we concat from and to, we have to omit some results
          resolve(transactions)
        })
      })
    )

    return allTransactions
      .reduce((current, next) => current.concat(next))
      .map((transaction: any) => {
        return {
          amount: new BigNumber(transaction.amount),
          fee: new BigNumber(transaction.fee),
          from: [transaction.source],
          isInbound: addresses.indexOf(transaction.destination) !== -1,
          protocolIdentifier: this.identifier,
          to: [transaction.destination],
          hash: transaction.operation_group_hash,
          timestamp: transaction.timestamp / 1000,
          blockHeight: transaction.block_level
        }
      })
  }

  public async signWithPrivateKey(privateKey: Buffer, transaction: RawTezosTransaction): Promise<IAirGapSignedTransaction> {
    await sodium.ready

    const watermark: string = '03'
    const watermarkedForgedOperationBytesHex: string = watermark + transaction.binaryTransaction
    const watermarkedForgedOperationBytes: Buffer = Buffer.from(watermarkedForgedOperationBytesHex, 'hex')
    const hashedWatermarkedOpBytes: Buffer = sodium.crypto_generichash(32, watermarkedForgedOperationBytes)

    const opSignature: Buffer = sodium.crypto_sign_detached(hashedWatermarkedOpBytes, privateKey)
    const signedOpBytes: Buffer = Buffer.concat([Buffer.from(transaction.binaryTransaction, 'hex'), Buffer.from(opSignature)])

    return signedOpBytes.toString('hex')
  }

  public async getTransactionDetails(unsignedTx: UnsignedTezosTransaction): Promise<IAirGapTransaction[]> {
    const binaryTransaction: string = unsignedTx.transaction.binaryTransaction
    const wrappedOperations: TezosWrappedOperation = await this.unforgeUnsignedTezosWrappedOperation(binaryTransaction)

    return this.getAirGapTxFromWrappedOperations(wrappedOperations)
  }

  public async getTransactionDetailsFromSigned(signedTx: SignedTezosTransaction): Promise<IAirGapTransaction[]> {
    const binaryTransaction: string = signedTx.transaction
    const wrappedOperations: TezosWrappedOperation = await this.unforgeSignedTezosWrappedOperation(binaryTransaction)

    return this.getAirGapTxFromWrappedOperations(wrappedOperations)
  }

  public getAirGapTxFromWrappedOperations(wrappedOperations: TezosWrappedOperation): IAirGapTransaction[] {
    const airGapTxs: IAirGapTransaction[] = []

    const assertNever: (x: never) => void = (x: never): void => undefined

    for (let i: number = 0; i < wrappedOperations.contents.length; i++) {
      const tezosOperation: TezosOperation = wrappedOperations.contents[i]
      let operation: TezosRevealOperation | TezosTransactionOperation | TezosOriginationOperation | TezosDelegationOperation | undefined

      let amount: BigNumber = new BigNumber(0)
      let to: string[] = []
      let from: string[] = []

      switch (tezosOperation.kind) {
        case TezosOperationType.REVEAL:
          operation = tezosOperation as TezosRevealOperation
          from = [operation.source]
          to = ['Reveal']
          break
        case TezosOperationType.TRANSACTION:
          const tezosSpendOperation: TezosTransactionOperation = tezosOperation as TezosTransactionOperation
          operation = tezosSpendOperation
          from = [operation.source]
          amount = new BigNumber(tezosSpendOperation.amount)
          to = [tezosSpendOperation.destination] // contract destination but should be the address of actual receiver

          // FA 1.2 support
          if (
            tezosSpendOperation.parameters?.entrypoint === 'transfer' &&
            (tezosSpendOperation.parameters?.value as any).args.length === 2
          ) {
            const value = tezosSpendOperation.parameters?.value as any
            from = [value.args[0].string]
            to = [value.args[1].args[0].string]
            amount = value.args[1].args[1].int
          }

          break
        case TezosOperationType.ORIGINATION:
          {
            const tezosOriginationOperation: TezosOriginationOperation = tezosOperation as TezosOriginationOperation
            operation = tezosOriginationOperation
            from = [operation.source]
            amount = new BigNumber(tezosOriginationOperation.balance)
            const delegate: string | undefined = tezosOriginationOperation.delegate
            to = [delegate ? `Delegate: ${delegate}` : 'Origination']
          }
          break
        case TezosOperationType.DELEGATION:
          {
            operation = tezosOperation as TezosDelegationOperation
            const delegate: string | undefined = operation.delegate
            from = [operation.source]
            to = [delegate ? delegate : 'Undelegate']
          }
          break
        case TezosOperationType.ENDORSEMENT:
        case TezosOperationType.SEED_NONCE_REVELATION:
        case TezosOperationType.DOUBLE_ENDORSEMENT_EVIDENCE:
        case TezosOperationType.DOUBLE_BAKING_EVIDENCE:
        case TezosOperationType.ACTIVATE_ACCOUNT:
        case TezosOperationType.PROPOSALS:
        case TezosOperationType.BALLOT:
          throw new Error('operation not supported: ' + tezosOperation.kind)
        default:
          assertNever(tezosOperation.kind) // Exhaustive switch
          throw new Error('no operation to unforge found')
      }

      const airgapTx: IAirGapTransaction = {
        amount: amount.toString(10),
        fee: new BigNumber(operation.fee).toString(10),
        from,
        isInbound: false,
        protocolIdentifier: this.identifier,
        to,
        transactionDetails: tezosOperation
      }

      airGapTxs.push(airgapTx)
    }

    return airGapTxs
  }

  public async getBalanceOfAddresses(addresses: string[]): Promise<string> {
    let balance: BigNumber = new BigNumber(0)

    for (const address of addresses) {
      try {
        const { data }: AxiosResponse = await axios.get(`${this.jsonRPCAPI}/chains/main/blocks/head/context/contracts/${address}/balance`)
        balance = balance.plus(new BigNumber(data))
      } catch (error) {
        // if node returns 404 (which means 'no account found'), go with 0 balance
        if (error.response && error.response.status !== 404) {
          throw error
        }
      }
    }

    return balance.toString(10)
  }

  public async getBalanceOfPublicKey(publicKey: string): Promise<string> {
    const address: string = await this.getAddressFromPublicKey(publicKey)

    return this.getBalanceOfAddresses([address])
  }

  public async getAvailableBalanceOfAddresses(addresses: string[]): Promise<string> {
    return this.getBalanceOfAddresses(addresses)
  }

  public async estimateMaxTransactionValueFromPublicKey(publicKey: string, fee: string): Promise<string> {
    const balance = await this.getBalanceOfPublicKey(publicKey)

    let amountWithoutFees = new BigNumber(balance).minus(new BigNumber(fee))
    if (amountWithoutFees.isNegative()) {
      amountWithoutFees = new BigNumber(0)
    }
    return amountWithoutFees.toFixed()
  }

  public async prepareTransactionFromPublicKey(
    publicKey: string,
    recipients: string[],
    values: string[],
    fee: string,
    data?: { addressIndex: number }
  ): Promise<RawTezosTransaction> {
    if (recipients.length !== values.length) {
      throw new Error('length of recipients and values does not match!')
    }

    if (recipients.length > MAX_OPERATIONS_PER_GROUP) {
      throw new Error(
        `this transaction exceeds the maximum allowed number of transactions per operation (${MAX_OPERATIONS_PER_GROUP}). Please use the "prepareTransactionsFromPublicKey" method instead.`
      )
    }

    const transactions: RawTezosTransaction[] = await this.prepareTransactionsFromPublicKey(publicKey, recipients, values, fee, data)
    if (transactions.length === 1) {
      return transactions[0]
    } else {
      throw new Error('Transaction could not be prepared. More or less than 1 operations have been generated.')
    }
  }

  public async prepareTransactionsFromPublicKey(
    publicKey: string,
    recipients: string[],
    values: string[],
    fee: string,
    data?: { addressIndex: number },
    operationsPerGroup: number = MAX_OPERATIONS_PER_GROUP
  ): Promise<RawTezosTransaction[]> {
    const wrappedValues: BigNumber[] = values.map((value: string) => new BigNumber(value))
    const wrappedFee: BigNumber = new BigNumber(fee)

    if (recipients.length !== wrappedValues.length) {
      throw new Error('length of recipients and values does not match!')
    }

    let counter: BigNumber = new BigNumber(1)
    let branch: string

    const operations: TezosOperation[] = []

    // check if we got an address-index
    const addressIndex: number = data && data.addressIndex ? data.addressIndex : 0
    const addresses: string[] = await this.getAddressesFromPublicKey(publicKey)

    if (!addresses[addressIndex]) {
      throw new Error('no kt-address with this index exists')
    }

    const address: string = addresses[addressIndex]

    try {
      const results = await Promise.all([
        axios.get(`${this.jsonRPCAPI}/chains/main/blocks/head/context/contracts/${address}/counter`),
        axios.get(`${this.jsonRPCAPI}/chains/main/blocks/head/hash`),
        axios.get(`${this.jsonRPCAPI}/chains/main/blocks/head/context/contracts/${address}/manager_key`)
      ])

      counter = new BigNumber(results[0].data).plus(1)
      branch = results[1].data

      const accountManager: { key: string } = results[2].data

      // check if we have revealed the address already
      if (!accountManager) {
        operations.push(await this.createRevealOperation(counter, publicKey, address))
        counter = counter.plus(1)
      }
    } catch (error) {
      throw error
    }

    const balance: BigNumber = new BigNumber(await this.getBalanceOfPublicKey(publicKey))

    const wrappedOperations: RawTezosTransaction[] = []

    const numberOfGroups: number = Math.ceil(recipients.length / operationsPerGroup)
    for (let i = 0; i < numberOfGroups; i++) {
      const start = i * operationsPerGroup
      const end = start + operationsPerGroup

      const recipientsInGroup = recipients.slice(start, end)
      const valuesInGroup = wrappedValues.slice(start, end)

      const operationsGroup = await this.createTransactionOperation(
        operations,
        recipientsInGroup,
        valuesInGroup,
        wrappedFee,
        address,
        counter,
        balance
      )
      counter = counter.plus(operationsGroup.length)

      wrappedOperations.push(
        await this.forgeAndWrapOperations({
          branch,
          contents: operationsGroup
        })
      )
    }

    return wrappedOperations
  }

  private async createTransactionOperation(
    previousOperations: TezosOperation[],
    recipients: string[],
    wrappedValues: BigNumber[],
    wrappedFee: BigNumber,
    address: string,
    counter: BigNumber,
    balance: BigNumber
  ) {
    const amountUsedByPreviousOperations: BigNumber = this.getAmountUsedByPreviousOperations(previousOperations)

    const operations: TezosOperation[] = []

    if (!amountUsedByPreviousOperations.isZero()) {
      if (balance.isLessThan(wrappedValues[0].plus(wrappedFee).plus(amountUsedByPreviousOperations))) {
        // if not, make room for the init fee
        wrappedValues[0] = wrappedValues[0].minus(amountUsedByPreviousOperations) // deduct fee from balance
      }
    }

    // TODO: We currently do not correctly calculate whether we have enough balance to pay the activation burn if there are multiple recipients
    for (let i: number = 0; i < recipients.length; i++) {
      const receivingBalance: BigNumber = new BigNumber(await this.getBalanceOfAddresses([recipients[i]]))

      // if our receiver has 0 balance, the account is not activated yet.
      if (receivingBalance.isZero() && recipients[i].toLowerCase().startsWith('tz')) {
        // We have to supply an additional 0.257 XTZ fee for storage_limit costs, which gets automatically deducted from the sender so we just have to make sure enough balance is around
        if (balance.isLessThan(this.activationBurn.plus(wrappedFee))) {
          // If we don't have enough funds to pay the activation + fee, we throw an error
          throw new Error('Not enough funds to pay activation burn!')
        } else if (balance.isLessThan(wrappedValues[i].plus(wrappedFee).plus(this.activationBurn))) {
          // Check whether the sender has enough to cover the amount to send + fee + activation
          // If not, we deduct it from amount sent to make room for the activation burn
          wrappedValues[i] = wrappedValues[i].minus(this.activationBurn) // deduct fee from balance
        }
      }

      if (balance.isEqualTo(wrappedValues[i].plus(wrappedFee))) {
        // Tezos accounts can never be empty. If user tries to send everything, we must leave 1 mutez behind.
        wrappedValues[i] = wrappedValues[i].minus(1)
      } else if (balance.isLessThan(wrappedValues[i].plus(wrappedFee))) {
        throw new Error('not enough balance')
      }

      const adjustedFee: BigNumber = recipients[0].toLowerCase().startsWith('kt') ? wrappedFee.plus(500) : wrappedFee

      const spendOperation: TezosTransactionOperation = {
        kind: TezosOperationType.TRANSACTION,
        fee: adjustedFee.toFixed(),
        gas_limit: recipients[i].toLowerCase().startsWith('kt') ? '15385' : '10300',
        storage_limit: receivingBalance.isZero() && recipients[i].toLowerCase().startsWith('tz') ? '300' : '0', // taken from eztz
        amount: wrappedValues[i].toFixed(),
        counter: counter.plus(i).toFixed(),
        destination: recipients[i],
        source: address
      }

      operations.push(spendOperation)
    }

    return operations
  }

  public async forgeAndWrapOperations(tezosWrappedOperation: TezosWrappedOperation): Promise<RawTezosTransaction> {
    try {
      const binaryTx: string = await this.forgeTezosOperation(tezosWrappedOperation)

      return { binaryTransaction: binaryTx }
    } catch (error) {
      console.warn(error.message)
      throw new Error('Forging Tezos TX failed.')
    }
  }

  public async getDefaultDelegatee(): Promise<string> {
    const { data: activeBakers } = await axios.get(`${this.jsonRPCAPI}/chains/main/blocks/head/context/delegates?active`)

    return activeBakers[0] || ''
  }

  public async getCurrentDelegateesForPublicKey(publicKey: string): Promise<string[]> {
    return this.getCurrentDelegateesForAddress(await this.getAddressFromPublicKey(publicKey))
  }

  public async getCurrentDelegateesForAddress(address: string): Promise<string[]> {
    const { data } = await axios.get(`${this.jsonRPCAPI}/chains/main/blocks/head/context/contracts/${address}`)
    return data.delegate ? [data.delegate] : []
  }

  public async getDelegateeDetails(address: string): Promise<DelegateeDetails> {
    const bakerInfo = await this.bakerInfo(address)

    return {
      status: bakerInfo.bakingActive ? 'Active' : 'Inactive',
      address: address
    }
  }


  public async isPublicKeyDelegating(publicKey: string): Promise<boolean> {
    return this.isAddressDelegating(await this.getAddressFromPublicKey(publicKey))
  }

  public async isAddressDelegating(address: string): Promise<boolean> {
    const { data } = await axios.get(`${this.jsonRPCAPI}/chains/main/blocks/head/context/contracts/${address}`)
    return !!data.delegate
  }

  public async getDelegationDetailsFromPublicKey(publicKey: string, delegatees: string[]): Promise<DelegationDetails> {
    return this.getDelegationDetailsFromAddress(await this.getAddressFromPublicKey(publicKey), delegatees)
  }

  public async getDelegationDetailsFromAddress(address: string, delegatees: string[]): Promise<DelegationDetails> {
    if (delegatees.length > 1) {
      return Promise.reject('Multiple delegation is not supported.')
    }

    const bakerAddress = delegatees[0]

    const results = await Promise.all([
      axios.get(`${this.jsonRPCAPI}/chains/main/blocks/head/context/contracts/${address}`),
      this.getDelegationRewardsForAddress(address).catch(() => null),
      this.getDelegateeDetails(bakerAddress),
    ])

    const accountDetails = results[0]?.data
    const rewardInfo = results[1]
    const bakerDetails = results[2]

    if (!accountDetails || !bakerDetails) {
      return Promise.reject('Could not fetch necessary details.')
    }

    const balance = accountDetails.balance
    const isDelegating = !!accountDetails.delegate
    const availableActions: DelegatorAction[] = []

    if (!isDelegating) {
      availableActions.push({
        type: TezosDelegatorAction.DELEGATE,
        args: ['delegate']
      })
    } else if (accountDetails.delegate === bakerAddress) {
      availableActions.push({
        type: TezosDelegatorAction.UNDELEGATE
      })
    } else {
      availableActions.push({
        type: TezosDelegatorAction.CHANGE_BAKER,
        args: ['delegate']
      })
    }

    const rewards = isDelegating && rewardInfo
      ? rewardInfo
        .map(reward => ({
          index: reward.cycle,
          amount: reward.reward.toFixed(),
          collected: reward.payout < new Date(),
          timestamp: reward.payout.getTime()
        }))
      : []

    return {
      delegator: {
        address,
        balance,
        delegatees: [accountDetails.delegate],
        availableActions,
        rewards
      },
      delegatees: [bakerDetails]
    }
  }

  public async prepareDelegatorActionFromPublicKey(publicKey: string, type: TezosDelegatorAction, data?: any): Promise<RawTezosTransaction[]> {
    switch (type) {
      case TezosDelegatorAction.DELEGATE:
      case TezosDelegatorAction.CHANGE_BAKER:
        if (!data || !data.delegate) {
          return Promise.reject(`Invalid arguments passed for ${type} action, delegate is missing.`)
        }
        return [await this.delegate(publicKey, data.delegate)]
      case TezosDelegatorAction.UNDELEGATE:
        return [await this.undelegate(publicKey)]
      default:
        return Promise.reject('Unsupported delegator action.')
    }
  }

  public async prepareOperations(publicKey: string, operationRequests: TezosOperation[]): Promise<TezosWrappedOperation> {
    let counter: BigNumber = new BigNumber(1)
    let branch: string

    const operations: TezosOperation[] = []

    const address: string = await this.getAddressFromPublicKey(publicKey)

    try {
      const results = await Promise.all([
        axios.get(`${this.jsonRPCAPI}/chains/main/blocks/head/context/contracts/${address}/counter`),
        axios.get(`${this.jsonRPCAPI}/chains/main/blocks/head/hash`),
        axios.get(`${this.jsonRPCAPI}/chains/main/blocks/head/context/contracts/${address}/manager_key`)
      ])

      counter = new BigNumber(results[0].data).plus(1)
      branch = results[1].data

      const accountManager: { key: string } = results[2].data

      const hasRevealInOperationRequests: boolean = operationRequests.some(
        (request: TezosOperation) => request.kind === TezosOperationType.REVEAL
      )

      // check if we have revealed the address already
      if (!accountManager && !hasRevealInOperationRequests) {
        operations.push(await this.createRevealOperation(counter, publicKey, address))
        counter = counter.plus(1)
      }
    } catch (error) {
      throw error
    }

    // tslint:disable:cyclomatic-complexity
    const operationPromises: Promise<TezosOperation>[] = operationRequests.map(async (operationRequest: TezosOperation, index: number) => {
      // TODO: Handle activation burn

      if (!operationRequest.kind) {
        throw new Error('property "kind" was not defined')
      }

      const recipient: string | undefined = (operationRequest as TezosTransactionOperation).destination
      let receivingBalance: BigNumber | undefined
      if (recipient) {
        receivingBalance = new BigNumber(await this.getBalanceOfAddresses([recipient]))
      }

      const defaultCounter: string = counter.plus(index).toFixed() // TODO: Handle counter if we have some operations without counters in the array
      const defaultFee: string = new BigNumber(this.feeDefaults.low).times(1000000).toFixed()
      const defaultGasLimit: string = recipient && recipient.toLowerCase().startsWith('kt') ? '15385' : '10300' // taken from eztz
      const defaultStorageLimit: string =
        receivingBalance && receivingBalance.isZero() && recipient && recipient.toLowerCase().startsWith('tz') ? '300' : '0' // taken from eztz

      switch (operationRequest.kind) {
        // TODO: Handle if the dApp already provides a reveal operation
        case TezosOperationType.REVEAL:
          const revealOperation: TezosRevealOperation = operationRequest as TezosRevealOperation

          if (!revealOperation.public_key) {
            throw new Error('property "public_key" was not defined')
          }

          revealOperation.source = revealOperation.source ?? address
          revealOperation.counter = revealOperation.counter ?? defaultCounter
          revealOperation.fee = revealOperation.fee ?? defaultFee
          revealOperation.gas_limit = revealOperation.gas_limit ?? defaultGasLimit
          revealOperation.storage_limit = revealOperation.storage_limit ?? defaultStorageLimit

          return revealOperation
        case TezosOperationType.DELEGATION:
          const delegationOperation: TezosDelegationOperation = operationRequest as TezosDelegationOperation

          // The delegate property is optional, so we don't have any mandatory properties to check for

          delegationOperation.source = delegationOperation.source ?? address
          delegationOperation.counter = delegationOperation.counter ?? defaultCounter
          delegationOperation.fee = delegationOperation.fee ?? defaultFee
          delegationOperation.gas_limit = delegationOperation.gas_limit ?? defaultGasLimit
          delegationOperation.storage_limit = delegationOperation.storage_limit ?? defaultStorageLimit

          return delegationOperation
        case TezosOperationType.TRANSACTION:
          const transactionOperation: TezosTransactionOperation = operationRequest as TezosTransactionOperation

          if (!transactionOperation.amount) {
            throw new Error('property "amount" was not defined')
          }

          if (!transactionOperation.destination) {
            throw new Error('property "destination" was not defined')
          }

          transactionOperation.source = transactionOperation.source ?? address
          transactionOperation.counter = transactionOperation.counter ?? defaultCounter
          transactionOperation.fee = transactionOperation.fee ?? defaultFee
          transactionOperation.gas_limit = transactionOperation.gas_limit ?? defaultGasLimit
          transactionOperation.storage_limit = transactionOperation.storage_limit ?? defaultStorageLimit

          return transactionOperation
        case TezosOperationType.ORIGINATION:
          const originationOperation: TezosOriginationOperation = operationRequest as TezosOriginationOperation

          if (!originationOperation.balance) {
            throw new Error('property "balance" was not defined')
          }

          if (!originationOperation.script) {
            throw new Error('property "script" was not defined')
          }

          originationOperation.source = originationOperation.source ?? address
          originationOperation.counter = originationOperation.counter ?? defaultCounter
          originationOperation.fee = originationOperation.fee ?? defaultFee
          originationOperation.gas_limit = originationOperation.gas_limit ?? defaultGasLimit
          originationOperation.storage_limit = originationOperation.storage_limit ?? defaultStorageLimit

          return originationOperation
        case TezosOperationType.ENDORSEMENT:
        case TezosOperationType.SEED_NONCE_REVELATION:
        case TezosOperationType.DOUBLE_ENDORSEMENT_EVIDENCE:
        case TezosOperationType.DOUBLE_BAKING_EVIDENCE:
        case TezosOperationType.ACTIVATE_ACCOUNT:
        case TezosOperationType.PROPOSALS:
        case TezosOperationType.BALLOT:
          // Do not change anything
          return operationRequest
        default:
          assertNever(operationRequest.kind)
          throw new Error(`unsupported operation type "${operationRequest.kind}"`)
      }
    })

    operations.push(...(await Promise.all(operationPromises)))

    const tezosWrappedOperation: TezosWrappedOperation = {
      branch,
      contents: operations
    }

    return tezosWrappedOperation
  }

  public async getDelegationInfo(delegatedAddress: string, fetchExtraInfo: boolean = true): Promise<DelegationInfo> {
    const { data } = await axios.get(`${this.jsonRPCAPI}/chains/main/blocks/head/context/contracts/${delegatedAddress}`)
    let delegatedOpLevel: number | undefined
    let delegatedDate: Date | undefined

    // if the address is delegated, check since when
    if (data.delegate && fetchExtraInfo) {
      const getDataFromMostRecentTransaction = (transactions): { date: Date; opLevel: number } | void => {
        if (transactions.length > 0) {
          const mostRecentTransaction = transactions[0]

          return {
            date: new Date(mostRecentTransaction.timestamp),
            opLevel: mostRecentTransaction.block_level
          }
        }
      }
      const getRequestBody = (field: string, set: string) => {
        return {
          predicates: [
            {
              field,
              operation: 'eq',
              set: [delegatedAddress],
              inverse: false
            },
            {
              field: 'kind',
              operation: 'eq',
              set: [set],
              inverse: false
            }
          ],
          orderBy: [
            {
              field: 'block_level',
              direction: 'desc'
            }
          ]
        }
      }

      // We first try to get the data from the lastest delegation
      // After that try to get it from the origination
      const transactionSourceUrl = `${this.baseApiUrl}/v2/data/tezos/${this.baseApiNetwork}/operations`
      const results = await Promise.all([
        axios
          .post(transactionSourceUrl, getRequestBody('source', 'delegation'), {
            headers: this.headers
          })
          .catch(() => {
            return { data: [] }
          }),
        axios
          .post(transactionSourceUrl, getRequestBody('manager_pubkey', 'origination'), {
            headers: this.headers
          })
          .catch(() => {
            return { data: [] }
          })
      ])

      const combinedData = results[0].data.concat(results[1].data)

      const recentTransactionData = getDataFromMostRecentTransaction(combinedData)
      if (recentTransactionData) {
        delegatedDate = recentTransactionData.date
        delegatedOpLevel = recentTransactionData.opLevel
      }
    }

    return {
      isDelegated: data.delegate ? true : false,
      value: data.delegate,
      delegatedDate,
      delegatedOpLevel
    }
  }

  public async bakerInfo(tzAddress: string | undefined): Promise<BakerInfo> {
    if (
      !tzAddress ||
      !(tzAddress.toLowerCase().startsWith('tz1') || tzAddress.toLowerCase().startsWith('tz2') || tzAddress.toLowerCase().startsWith('tz3'))
    ) {
      throw new Error('non tz-address supplied')
    }

    const results: AxiosResponse[] = await Promise.all([
      axios.get(`${this.jsonRPCAPI}/chains/main/blocks/head/context/delegates/${tzAddress}/balance`),
      axios.get(`${this.jsonRPCAPI}/chains/main/blocks/head/context/delegates/${tzAddress}/delegated_balance`),
      axios.get(`${this.jsonRPCAPI}/chains/main/blocks/head/context/delegates/${tzAddress}/staking_balance`),
      axios.get(`${this.jsonRPCAPI}/chains/main/blocks/head/context/delegates/${tzAddress}/deactivated`)
    ])

    const tzBalance: BigNumber = new BigNumber(results[0].data)
    const delegatedBalance: BigNumber = new BigNumber(results[1].data)
    const stakingBalance: BigNumber = new BigNumber(results[2].data)
    const isBakingActive: boolean = !results[3].data // we need to negate as the query is "deactivated"

    // calculate the self bond of the baker
    const selfBond: BigNumber = stakingBalance.minus(delegatedBalance)

    // check what capacity is staked relatively to the self-bond
    const stakingCapacity: BigNumber = stakingBalance.div(selfBond.div(SELF_BOND_REQUIREMENT))

    const bakerInfo: BakerInfo = {
      balance: tzBalance,
      delegatedBalance,
      stakingBalance,
      bakingActive: isBakingActive,
      selfBond,
      bakerCapacity: stakingBalance.div(stakingCapacity),
      bakerUsage: stakingCapacity
    }

    return bakerInfo
  }

  public async getDelegationRewardsForAddress(address: string): Promise<DelegationRewardInfo[]> {
    const status: DelegationInfo = await this.getDelegationInfo(address)

    if (!status.isDelegated || !status.value) {
      throw new Error('address not delegated')
    }

    return this.getDelegationRewards(status.value, address)
  }

  public async getDelegationRewards(bakerAddress: string, delegatorAddress?: string): Promise<DelegationRewardInfo[]> {
    const { data: frozenBalance }: AxiosResponse<[{ cycle: number; deposit: string; fees: string; rewards: string }]> = await axios.get(
      `${this.jsonRPCAPI}/chains/main/blocks/head/context/delegates/${bakerAddress}/frozen_balance_by_cycle`
    )

    const lastConfirmedCycle: number = frozenBalance[0].cycle - 1
    const mostRecentCycle: number = frozenBalance[frozenBalance.length - 1].cycle

    const { data: mostRecentBlock } = await axios.get(
      `${this.jsonRPCAPI}/chains/main/blocks/${mostRecentCycle * TezosProtocol.BLOCKS_PER_CYCLE[this.network]}`
    )
    const timestamp: Date = new Date(mostRecentBlock.header.timestamp)

    const delegationInfo: DelegationRewardInfo[] = await Promise.all(
      frozenBalance.map(async obj => {
        const { data: delegatedBalanceAtCycle } = await axios.get(
          `${this.jsonRPCAPI}/chains/main/blocks/${(obj.cycle - 6) * TezosProtocol.BLOCKS_PER_CYCLE[this.network]}/context/contracts/${
          delegatorAddress ? delegatorAddress : bakerAddress
          }/balance`
        )

        const { data: stakingBalanceAtCycle } = await axios.get(
          `${this.jsonRPCAPI}/chains/main/blocks/${(obj.cycle - 6) *
          TezosProtocol.BLOCKS_PER_CYCLE[this.network]}/context/delegates/${bakerAddress}/staking_balance`
        )

        return {
          cycle: obj.cycle,
          totalRewards: new BigNumber(obj.rewards),
          totalFees: new BigNumber(obj.fees),
          deposit: new BigNumber(obj.deposit),
          delegatedBalance: new BigNumber(delegatedBalanceAtCycle),
          stakingBalance: new BigNumber(stakingBalanceAtCycle),
          reward: new BigNumber(obj.rewards).plus(obj.fees).multipliedBy(new BigNumber(delegatedBalanceAtCycle).div(stakingBalanceAtCycle)),
          payout: new Date(
            timestamp.getTime() + (obj.cycle - lastConfirmedCycle) * TezosProtocol.BLOCKS_PER_CYCLE[this.network] * 60 * 1000
          )
        }
      })
    )

    return delegationInfo
  }

  public async undelegate(publicKey: string): Promise<RawTezosTransaction> {
    return this.delegate(publicKey)
  }

  public async delegate(publicKey: string, delegate?: string | string[]): Promise<RawTezosTransaction> {
    let counter: BigNumber = new BigNumber(1)
    let branch: string

    const operations: TezosOperation[] = []
    const tzAddress: string = await this.getAddressFromPublicKey(publicKey)

    try {
      const results: AxiosResponse[] = await Promise.all([
        axios.get(`${this.jsonRPCAPI}/chains/main/blocks/head/context/contracts/${tzAddress}/counter`),
        axios.get(`${this.jsonRPCAPI}/chains/main/blocks/head/hash`),
        axios.get(`${this.jsonRPCAPI}/chains/main/blocks/head/context/contracts/${tzAddress}/manager_key`)
      ])

      counter = new BigNumber(results[0].data).plus(1)
      branch = results[1].data

      const accountManager: string = results[2].data

      // check if we have revealed the address already
      if (!accountManager) {
        operations.push(await this.createRevealOperation(counter, publicKey, tzAddress))
        counter = counter.plus(1)
      }
    } catch (error) {
      throw error
    }

    const balance: BigNumber = new BigNumber(await this.getBalanceOfAddresses([tzAddress]))

    const fee: BigNumber = new BigNumber(1420)

    if (balance.isLessThan(fee)) {
      throw new Error('not enough balance')
    }

    const delegationOperation: TezosDelegationOperation = {
      kind: TezosOperationType.DELEGATION,
      source: tzAddress,
      fee: fee.toFixed(),
      counter: counter.toFixed(),
      gas_limit: '10000', // taken from eztz
      storage_limit: '0', // taken from eztz
      delegate: isArray(delegate) ? delegate[0] : delegate
    }

    operations.push(delegationOperation)

    try {
      const tezosWrappedOperation: TezosWrappedOperation = {
        branch,
        contents: operations
      }

      const binaryTx: string = await this.forgeTezosOperation(tezosWrappedOperation)

      return { binaryTransaction: binaryTx }
    } catch (error) {
      console.warn(error)
      throw new Error('Forging Tezos TX failed.')
    }
  }

  private getAmountUsedByPreviousOperations(operations: TezosOperation[]): BigNumber {
    let amountUsed: BigNumber = new BigNumber(0)

    operations.forEach((operation: TezosOperation) => {
      switch (operation.kind) {
        case TezosOperationType.REVEAL:
          const revealOperation = operation as TezosRevealOperation
          amountUsed = amountUsed.plus(revealOperation.fee)
          break
        case TezosOperationType.ORIGINATION:
          const originationOperation: TezosOriginationOperation = operation as TezosOriginationOperation
          amountUsed = amountUsed.plus(originationOperation.fee)
          amountUsed = amountUsed.plus(originationOperation.balance)
          break
        case TezosOperationType.DELEGATION:
          const delegationOperation = operation as TezosDelegationOperation
          amountUsed = amountUsed.plus(delegationOperation.fee)
          break
        case TezosOperationType.TRANSACTION:
          const spendOperation: TezosTransactionOperation = operation as TezosTransactionOperation
          amountUsed = amountUsed.plus(spendOperation.fee)
          amountUsed = amountUsed.plus(spendOperation.amount)
          break
        case TezosOperationType.ENDORSEMENT:
        case TezosOperationType.SEED_NONCE_REVELATION:
        case TezosOperationType.DOUBLE_ENDORSEMENT_EVIDENCE:
        case TezosOperationType.DOUBLE_BAKING_EVIDENCE:
        case TezosOperationType.ACTIVATE_ACCOUNT:
        case TezosOperationType.PROPOSALS:
        case TezosOperationType.BALLOT:
          break
        default:
          assertNever(operation.kind) // Exhaustive switch
          throw Error('operation type not supported' + operation.kind)
      }
    })

    return amountUsed
  }

  public async broadcastTransaction(rawTransaction: IAirGapSignedTransaction): Promise<string> {
    const payload: IAirGapSignedTransaction = rawTransaction

    try {
      const { data: injectionResponse }: { data: string } = await axios.post(
        `${this.jsonRPCAPI}/injection/operation?chain=main`,
        JSON.stringify(payload),
        {
          headers: { 'content-type': 'application/json' }
        }
      )

      // returns hash if successful
      return injectionResponse
    } catch (err) {
      console.warn((err as AxiosError).message, ((err as AxiosError).response as AxiosResponse).statusText)
      throw new Error(`broadcasting failed ${err}`)
    }
  }

  protected checkAndRemovePrefixToHex(base58CheckEncodedPayload: string, tezosPrefix: Uint8Array): string {
    const prefixHex: string = Buffer.from(tezosPrefix).toString('hex')
    const payload: string = bs58check.decode(base58CheckEncodedPayload).toString('hex')
    if (payload.startsWith(prefixHex)) {
      return payload.substring(tezosPrefix.length * 2)
    } else {
      throw new Error(`payload did not match prefix: ${prefixHex}`)
    }
  }

  public async unforgeSignedTezosWrappedOperation(hexString: string): Promise<TezosWrappedOperation> {
    if (hexString.length <= 128) {
      throw new Error('Not a valid signed transaction')
    }

    return this.unforgeUnsignedTezosWrappedOperation(hexString.substring(0, hexString.length - 128))
  }

  public async unforgeUnsignedTezosWrappedOperation(hexString: string): Promise<TezosWrappedOperation> {
    return localForger.parse(hexString) as any
  }

  public async forgeTezosOperation(tezosWrappedOperation: TezosWrappedOperation): Promise<string> {
    return localForger.forge(tezosWrappedOperation as any)
  }

  public async createRevealOperation(counter: BigNumber, publicKey: string, address: string): Promise<TezosRevealOperation> {
    const operation: TezosRevealOperation = {
      kind: TezosOperationType.REVEAL,
      fee: this.revealFee.toFixed(),
      gas_limit: '10000', // taken from conseiljs
      storage_limit: '0', // taken from conseiljs
      counter: counter.toFixed(),
      public_key: bs58check.encode(Buffer.concat([this.tezosPrefixes.edpk, Buffer.from(publicKey, 'hex')])),
      source: address
    }

    return operation
  }

  public async getTezosVotingInfo(blockHash: string): Promise<TezosVotingInfo[]> {
    const response: AxiosResponse = await axios.get(`${this.jsonRPCAPI}/chains/main/blocks/${blockHash}/votes/listings`)

    return response.data
  }

  public async fetchCurrentCycle(): Promise<number> {
    const headMetadata = await this.fetchBlockMetadata('head')
    const currentCycle: number = headMetadata.level.cycle

    return currentCycle
  }

  private static readonly FIRST_005_CYCLE: number = 160
  private static readonly FIRST_006_CYCLE: number = 208
  public async calculateRewards(bakerAddress: string, cycle: number): Promise<TezosRewards> {
    const is005 = this.network !== TezosNetwork.MAINNET || cycle >= TezosProtocol.FIRST_005_CYCLE
    const is006 = this.network === TezosNetwork.CARTHAGENET || cycle >= TezosProtocol.FIRST_006_CYCLE
    let rewardCalculation: TezosRewardsCalculations
    if (is006) {
      rewardCalculation = new TezosRewardsCalculation006(this)
    } else if (is005) {
      rewardCalculation = new TezosRewardsCalculation005(this)
    } else {
      rewardCalculation = new TezosRewardsCalculationDefault(this)
    }

    return rewardCalculation.calculateRewards(bakerAddress, cycle)
  }

  public async calculatePayouts(rewards: TezosRewards, offsetOrAddresses: number | string[], limit?: number): Promise<TezosPayoutInfo[]> {
    let delegators: string[]
    if (typeof offsetOrAddresses === 'number') {
      if (limit === undefined) {
        throw new Error('limit parameter is required when providing offset')
      }
      delegators = rewards.delegatedContracts.slice(offsetOrAddresses, Math.min(offsetOrAddresses + limit, rewards.delegatedContracts.length))
    } else {
      delegators = offsetOrAddresses
    }
    return this.calculatePayoutForAddresses(delegators, rewards)
  }

  public async calculatePayout(address: string, rewards: TezosRewards): Promise<TezosPayoutInfo> {
    const result = (await this.calculatePayoutForAddresses([address], rewards)).pop()
    if (result === undefined) {
      throw new Error(`cannot calculate payout for ${address}`)
    }

    return result
  }

  private async calculatePayoutForAddresses(addresses: string[], rewards: TezosRewards) {
    const result: TezosPayoutInfo[] = []
    const totalRewardsBN = new BigNumber(rewards.totalRewards).plus(new BigNumber(rewards.fees))
    const balances = await this.fetchBalances(addresses, rewards.snapshotBlockLevel)
    for (const balance of balances) {
      let amount = balance.balance
      if (amount === undefined) {
        amount = new BigNumber(0)
      }
      const share = amount.div(rewards.stakingBalance)
      const payoutAmount = totalRewardsBN.multipliedBy(share)
      result.push({
        delegator: balance.address,
        share: share.toFixed(),
        payout: payoutAmount.toFixed()
      })
    }

    return result
  }

  private async fetchBlockMetadata(block: number | 'head'): Promise<any> {
    const result = await axios.get(`${this.jsonRPCAPI}/chains/main/blocks/${block}/metadata`)

    return result.data
  }

  public static readonly BLOCKS_PER_CYCLE = {
    mainnet: 4096,
    babylonnet: 2048,
    carthagenet: 2048
  }

  private async fetchBalances(addresses: string[], blockLevel: number): Promise<{ address: string; balance: BigNumber }[]> {
    const body = {
      fields: ['account_id', 'balance'],
      predicates: [
        {
          field: 'account_id',
          operation: 'in',
          set: addresses
        }
      ],
      snapshot: {
        field: 'block_level',
        value: blockLevel
      }
    }
    const result = await axios.post(`${this.baseApiUrl}/v2/data/tezos/${this.baseApiNetwork}/accounts_history`, body, {
      headers: this.headers
    })

    return result.data.map(account => {
      return {
        address: account.account_id,
        balance: new BigNumber(account.balance)
      }
    })
  }

  public async signMessage(message: string, privateKey: Buffer): Promise<string> {
    return Promise.reject('Message signing not implemented')
  }

  public async verifyMessage(message: string, signature: string, publicKey: Buffer): Promise<boolean> {
    return Promise.reject('Message verification not implemented')
  }

  /*
  async signMessage(message: string, privateKey: Buffer): Promise<string> {
    await sodium.ready
    const signature = sodium.crypto_sign_detached(sodium.from_string(message), privateKey)
    const hexSignature = Buffer.from(signature).toString('hex')

    return hexSignature
  }

  async verifyMessage(message: string, hexSignature: string, publicKey: Buffer): Promise<boolean> {
    await sodium.ready
    const signature = new Uint8Array(Buffer.from(hexSignature, 'hex'))
    const isValidSignature = sodium.crypto_sign_verify_detached(signature, message, publicKey)

    return isValidSignature
  }
  */
}

export interface TezosBakingRight {
  level: number
  delegate: string
  priority: number
}

export interface TezosBakingRewards {
  totalBakingRewards: string
  rewardsDetails: { level: number; amount: string; deposit: string; fees?: string }[]
}

export interface TezosEndorsingRewards {
  totalEndorsingRewards: string
  rewardsDetails: { level: number; amount: string; deposit: string }[]
}

export interface TezosEndorsingRight {
  level: number
  block_level?: number
  delegate: string
  number_of_slots: number
}

export interface TezosRewardsCalculations {
  protocol: TezosProtocol
  calculateRewards(bakerAddress: string, cycle: number): Promise<TezosRewards>
}

export interface TezosRewards {
  baker: string
  stakingBalance: string
  bakingRewards: string
  bakingDeposits: string
  endorsingDeposits: string
  endorsingRewards: string
  fees: string
  deposit: string
  totalRewards: string
  cycle: number
  snapshotBlockLevel: number
  delegatedContracts: string[]
  bakingRewardsDetails: { level: number; amount: string; deposit: string; fees?: string }[]
  endorsingRewardsDetails: { level: number; amount: string; deposit: string }[]
}

export interface TezosBakerInfo {
  balance: string
  frozen_balance: string
  frozen_balance_by_cycle: TezosFrozenBalance[]
  staking_balance: string
  delegated_contracts: string[]
  delegated_balance: string
  deactivated: boolean
  grace_period: number
}

export interface TezosFrozenBalance {
  cycle: number
  deposit: string
  fees: string
  rewards: string
}

export interface TezosNodeConstants {
  proof_of_work_nonce_size: number
  nonce_length: number
  max_revelations_per_block: number
  max_operation_data_length: number
  max_proposals_per_delegate: number
  preserved_cycles: number
  blocks_per_cycle: number
  blocks_per_commitment: number
  blocks_per_roll_snapshot: number
  blocks_per_voting_period: number
  time_between_blocks: number[]
  endorsers_per_block: number
  hard_gas_limit_per_operation: string
  hard_gas_limit_per_block: string
  proof_of_work_threshold: number
  tokens_per_roll: string
  michelson_maximum_type_size: number
  seed_nonce_revelation_tip: string
  origination_size: number
  block_security_deposit: string
  endorsement_security_deposit: string
  cost_per_byte: string
  hard_storage_limit_per_operation: string
  test_chain_duration: string
  quorum_min: number
  quorum_max: number
  min_proposal_quorum: number
  initial_endorsers: number
  delay_per_missing_endorsement: string
}

export interface TezosNodeConstantsV1 extends TezosNodeConstants {
  block_reward: string
  endorsement_reward: string
}

export interface TezosNodeConstantsV2 extends TezosNodeConstants {
  baking_reward_per_endorsement: string[]
  endorsement_reward: string[]
}
