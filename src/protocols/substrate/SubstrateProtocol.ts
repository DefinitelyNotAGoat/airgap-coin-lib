
import { FeeDefaults, CurrencyUnit } from '../ICoinProtocol'
import { ICoinDelegateProtocol, DelegationDetails, DelegateeDetails } from '../ICoinDelegateProtocol'
import { NonExtendedProtocol } from '../NonExtendedProtocol'
import { SubstrateNodeClient } from './helpers/node/SubstrateNodeClient'
import BigNumber from '../../dependencies/src/bignumber.js-9.0.0/bignumber'
import { IAirGapTransaction } from '../..'
import { SubstrateTransactionType } from './helpers/data/transaction/SubstrateTransaction'
import { UnsignedSubstrateTransaction } from '../../serializer/schemas/definitions/transaction-sign-request-substrate'
import { SignedSubstrateTransaction } from '../../serializer/schemas/definitions/transaction-sign-response-substrate'
import { SubstratePayee } from './helpers/data/staking/SubstratePayee'
import { isString } from 'util'
import { RawSubstrateTransaction } from '../../serializer/types'
import { SubstrateAccountController } from './helpers/SubstrateAccountController'
import { SubstrateTransactionController } from './helpers/SubstrateTransactionController'
import { SubstrateBlockExplorerClient } from './helpers/blockexplorer/SubstrateBlockExplorerClient'
import { SubstrateStakingActionType } from './helpers/data/staking/SubstrateStakingActionType'
import { SubstrateAddress } from './helpers/data/account/SubstrateAddress'
import { SubstrateNetwork } from './SubstrateNetwork'
import { assertFields } from '../../utils/assert'

export abstract class SubstrateProtocol extends NonExtendedProtocol implements ICoinDelegateProtocol {    
    public abstract symbol: string
    public abstract name: string
    public abstract marketSymbol: string
    public abstract feeSymbol: string

    public abstract decimals: number
    public abstract feeDecimals: number
    public abstract identifier: string

    public abstract feeDefaults: FeeDefaults
    public abstract units: CurrencyUnit[]
    public abstract standardDerivationPath: string

    public supportsHD: boolean = false

    public addressIsCaseSensitive: boolean = false
    public addressValidationPattern: string = '^[a-km-zA-HJ-NP-Z1-9]+$' // TODO: set length?
    public addressPlaceholder: string = 'ABC...' // TODO: better placeholder?

    public blockExplorer: string = this.blockExplorerClient.baseUrl

    constructor(
        readonly network: SubstrateNetwork,
        readonly nodeClient: SubstrateNodeClient,
        readonly blockExplorerClient: SubstrateBlockExplorerClient,
        readonly accountController: SubstrateAccountController = new SubstrateAccountController(network, nodeClient),
        readonly transactionController: SubstrateTransactionController = new SubstrateTransactionController(network, nodeClient)
    ) { super() }

    public async getBlockExplorerLinkForAddress(address: string): Promise<string> {
        return `${this.blockExplorerClient.accountInfoUrl}/${address}`
    }

    public async getBlockExplorerLinkForTxId(txId: string): Promise<string> {
        return `${this.blockExplorerClient.transactionInfoUrl}/${txId}`
    }

    public async getPublicKeyFromMnemonic(mnemonic: string, derivationPath: string, password?: string): Promise<string> {
        const keyPair = await this.accountController.createKeyPairFromMnemonic(mnemonic, derivationPath, password)
        return keyPair.publicKey.toString('hex')
    }
    
    public async getPrivateKeyFromMnemonic(mnemonic: string, derivationPath: string, password?: string): Promise<Buffer> {
        const keyPair = await this.accountController.createKeyPairFromMnemonic(mnemonic, derivationPath, password)
        return keyPair.privateKey
    }

    public async getPublicKeyFromHexSecret(secret: string, derivationPath: string): Promise<string> {
        const keyPair = await this.accountController.createKeyPairFromHexSecret(secret, derivationPath)
        return keyPair.publicKey.toString('hex')
    }

    public async getPrivateKeyFromHexSecret(secret: string, derivationPath: string): Promise<Buffer> {
        const keyPair = await this.accountController.createKeyPairFromHexSecret(secret, derivationPath)
        return keyPair.privateKey
    }

    public async getAddressFromPublicKey(publicKey: string): Promise<string> {
        return this.accountController.createAddressFromPublicKey(publicKey)
    }
    
    public async getAddressesFromPublicKey(publicKey: string): Promise<string[]> {
        return [await this.getAddressFromPublicKey(publicKey)]
    }
    
    public async getTransactionsFromPublicKey(publicKey: string, limit: number, offset: number): Promise<IAirGapTransaction[]> {
        const addresses = await this.getAddressesFromPublicKey(publicKey)
        return this.getTransactionsFromAddresses(addresses, limit, offset)
    }
    
    public async getTransactionsFromAddresses(addresses: string[], limit: number, offset: number): Promise<IAirGapTransaction[]> {
        const pageNumber = Math.ceil(offset / limit) + 1
        const txs = await Promise.all(addresses.map(address => this.blockExplorerClient.getTransactions(address, limit, pageNumber)))

        return txs
            .reduce((flatten, toFlatten) => flatten.concat(toFlatten), [])
            .map(tx => ({
                protocolIdentifier: this.identifier,
                from: [],
                to: [],
                isInbound: false,
                amount: '',
                fee: '',
                ...tx
            }))
    }
    
    public async signWithPrivateKey(privateKey: Buffer, rawTransaction: RawSubstrateTransaction): Promise<string> {
        const txs = this.transactionController.decodeDetails(rawTransaction.encoded)
        const signed = await Promise.all(txs.map(tx => this.transactionController.signTransaction(privateKey, tx.transaction, tx.payload)))

        txs.forEach((tx, index) => tx.transaction = signed[index])

        return this.transactionController.encodeDetails(txs)
    }
    
    public async getTransactionDetails(transaction: UnsignedSubstrateTransaction): Promise<IAirGapTransaction[]> {
        return this.getTransactionDetailsFromEncoded(transaction.transaction.encoded)
    }
    
    public async getTransactionDetailsFromSigned(transaction: SignedSubstrateTransaction): Promise<IAirGapTransaction[]> {
        return this.getTransactionDetailsFromEncoded(transaction.transaction)
    }

    public async getBalanceOfAddresses(addresses: string[]): Promise<string> {
        const balances = await Promise.all(addresses.map(address => this.accountController.getBalance(address)))
        const balance = balances.reduce((current: BigNumber, next: BigNumber) => current.plus(next))

        return balance.toString(10)
    }

    public async getAvailableBalanceOfAddresses(addresses: string[]): Promise<string> {
        const balances = await Promise.all(addresses.map(address => this.accountController.getTransferableBalance(address, false)))
        const balance = balances.reduce((current: BigNumber, next: BigNumber) => current.plus(next))

        return balance.toString(10)
    }

    public async getBalanceOfPublicKey(publicKey: string): Promise<string> {
        return this.getBalanceOfAddresses([await this.getAddressFromPublicKey(publicKey)])        
    }

    public async getTransferFeeEstimate(publicKey: string, destination: string, value: string, tip: string = '0'): Promise<string> {
        const transaction = await this.transactionController.createTransaction(
            SubstrateTransactionType.TRANSFER, 
            publicKey, 
            tip,
            { 
                to: destination.length > 0 ? destination : publicKey,
                value: new BigNumber(value) 
            }
        )
        const fee = await this.transactionController.calculateTransactionFee(transaction)

        if (!fee) {
            return Promise.reject('Could not fetch all necessary data.')
        }

        return fee.toString(10)
    }

    public async estimateMaxTransactionValueFromPublicKey(publicKey: string, fee: string): Promise<string> {
        const results = await Promise.all([
            this.accountController.getTransferableBalance(publicKey),
            this.getFutureRequiredTransactions(publicKey, 'check'),
        ])

        const transferableBalance = results[0]
        const futureTransactions = results[1]
        
        const feeEstimate = await this.transactionController.estimateTransactionFees(futureTransactions)

        if (!feeEstimate) {
            return Promise.reject('Could not estimate max value.')
        }

        let maxAmount = transferableBalance
            .minus(feeEstimate)
            .minus(new BigNumber(fee))

        if (maxAmount.lt(0)) {
            maxAmount = new BigNumber(0)
        }

        return maxAmount.toFixed()
      }

    public async prepareTransactionFromPublicKey(
        publicKey: string, 
        recipients: string[], 
        values: string[], 
        fee: string, 
        data?: any
    ): Promise<RawSubstrateTransaction> {
        if (recipients.length !== values.length) {
            return Promise.reject("Recipients length doesn't match values length.")
        }

        const recipientsWithValues: [string, string][] = recipients.map((recipient, index) => [recipient, values[index]])

        const transferableBalance = await this.accountController.getTransferableBalance(publicKey)
        const totalValue = values.map(value => new BigNumber(value)).reduce((total, next) => total.plus(next), new BigNumber(0))
        const available = new BigNumber(transferableBalance).minus(totalValue)

        const encoded = await this.transactionController.prepareSubmittableTransactions(
            publicKey,
            available,
            recipientsWithValues.map(([recipient, value]) => ({
                type: SubstrateTransactionType.TRANSFER,
                tip: 0, // temporary, until we handle Substrate fee/tip model
                args: {
                    to: recipient,
                    value: new BigNumber(value)
                }
            }))
        )

        return { encoded }
    }

    public async broadcastTransaction(encoded: string): Promise<string> {
        const txs = this.transactionController.decodeDetails(encoded).map(tx => tx.transaction)

        try {
            const txHashes = await Promise.all(
                txs.map((tx, index) => this.nodeClient.submitTransaction(tx.encode()).catch(error => {
                    error.index = index
                    throw error
                }))
            )

            return txs[0].type !== SubstrateTransactionType.SUBMIT_BATCH ? txHashes[0] : ''
        } catch (error) {
            console.warn(`Transaction #${error.index} submit failure`, error)
            return Promise.reject(`Error while submitting transaction #${error.index}: ${SubstrateTransactionType[txs[error.index].type]}.`)
        }
    }

    public async getDefaultDelegatee(): Promise<string> {
        const validators = await this.nodeClient.getValidators()
        return validators ? validators[0].toString() : ''
    }

    public async getCurrentDelegateesForPublicKey(publicKey: string): Promise<string[]> {
        return this.accountController.getCurrentValidators(publicKey)
    }

    public async getCurrentDelegateesForAddress(address: string): Promise<string[]> {
        return this.accountController.getCurrentValidators(address)
    }

    public async getDelegateeDetails(address: string): Promise<DelegateeDetails> {
        const validatorDetails = await this.accountController.getValidatorDetails(address)
        return {
            name: validatorDetails.name || '',
            status: validatorDetails.status || '',
            address
        }
    }


    public async isPublicKeyDelegating(publicKey: string): Promise<boolean> {
        return this.accountController.isNominating(publicKey)
    }

    public async isAddressDelegating(address: string): Promise<boolean> {
        return this.accountController.isNominating(address)
    }

    public async getDelegationDetailsFromPublicKey(publicKey: string, delegatees: string[]): Promise<DelegationDetails> {
        return this.getDelegationDetailsFromAddress(await this.getAddressFromPublicKey(publicKey), delegatees)
    }

    public async getDelegationDetailsFromAddress(address: string, delegatees: string[]): Promise<DelegationDetails> {
        const [nominatorDetails, validatorsDetails] = await Promise.all([
            this.accountController.getNominatorDetails(address, delegatees),
            Promise.all(delegatees.map(validator => this.accountController.getValidatorDetails(validator))),
        ])

        nominatorDetails.rewards = nominatorDetails.delegatees.length > 0 && nominatorDetails.stakingDetails
            ? nominatorDetails.stakingDetails.rewards.map(reward => ({
                index: reward.eraIndex,
                amount: reward.amount,
                collected: reward.collected,
                timestamp: reward.timestamp
            })) : [] 

        return {
            delegator: nominatorDetails,
            delegatees: validatorsDetails
        }
    }

    public async prepareDelegatorActionFromPublicKey(
        publicKey: string, 
        type: SubstrateStakingActionType, 
        data?: any
    ): Promise<RawSubstrateTransaction[]> {
        if (!data) {
            data = {}
        }

        switch (type) {
            case SubstrateStakingActionType.BOND_NOMINATE:
                assertFields(`${SubstrateStakingActionType[type]} action`, data, 'targets', 'value', 'payee')
                return this.prepareDelegation(publicKey, data.tip || 0, data.targets, data.controller || publicKey, data.value, data.payee)
            case SubstrateStakingActionType.NOMINATE:
                assertFields(`${SubstrateStakingActionType[type]} action`, data, 'targets')
                return this.prepareDelegation(publicKey, data.tip || 0, data.targets)
            case SubstrateStakingActionType.CANCEL_NOMINATION:
                return this.prepareCancelDelegation(publicKey, data.tip || 0, data.value)
            case SubstrateStakingActionType.CHANGE_NOMINATION:
                assertFields(`${SubstrateStakingActionType[type]} action`, data, 'targets')
                return this.prepareChangeValidator(publicKey, data.tip || 0, data.targets)
            case SubstrateStakingActionType.UNBOND:
                assertFields(`${SubstrateStakingActionType[type]} action`, data, 'value')
                return this.prepareUnbond(publicKey, data.tip || 0, data.value)
            case SubstrateStakingActionType.REBOND:
                assertFields(`${SubstrateStakingActionType[type]} action`, data, 'value')
                return this.prepareRebond(publicKey, data.tip || 0, data.value)
            case SubstrateStakingActionType.BOND_EXTRA:
                assertFields(`${SubstrateStakingActionType[type]} action`, data, 'value')
                return this.prepareBondExtra(publicKey, data.tip || 0, data.value)
            case SubstrateStakingActionType.WITHDRAW_UNBONDED:
                return this.prepareWithdrawUnbonded(publicKey, data.tip || 0)
            case SubstrateStakingActionType.COLLECT_REWARDS:
                return this.prepareCollectRewards(publicKey, data.tip || 0)
            case SubstrateStakingActionType.CHANGE_REWARD_DESTINATION:
                return Promise.reject('Unsupported delegator action.')
            case SubstrateStakingActionType.CHANGE_CONTROLLER:
                return Promise.reject('Unsupported delegator action.')
            default:
                return Promise.reject('Unsupported delegator action.')
        }
    }

    public async prepareDelegation(
        publicKey: string,
        tip: string | number | BigNumber,
        targets: string[] | string,
        controller?: string,
        value?: string | number | BigNumber,
        payee?: string | SubstratePayee,
    ): Promise<RawSubstrateTransaction[]> {
        const transferableBalance = await this.accountController.getTransferableBalance(publicKey)
        const available = new BigNumber(transferableBalance).minus(value || 0)

        const bondFirst = (controller !== undefined && value !== undefined && payee !== undefined)

        const encoded = await this.transactionController.prepareSubmittableTransactions(publicKey, available, [
            ...(bondFirst ? [{
                type: SubstrateTransactionType.BOND,
                tip,
                args: {
                    controller,
                    value: BigNumber.isBigNumber(value) ? value : new BigNumber(value!),
                    payee: isString(payee) ? SubstratePayee[payee] :  payee
                }
            }] : []),
            {
                type: SubstrateTransactionType.NOMINATE,
                tip,
                args: { 
                    targets: isString(targets) ? [targets] : targets
                }
            }
        ])

        return [{ encoded }]
    }

    public async prepareCancelDelegation(
        publicKey: string,
        tip: string | number | BigNumber,
        value?: string | number | BigNumber
    ): Promise<RawSubstrateTransaction[]> {
        const transferableBalance = await this.accountController.getTransferableBalance(publicKey)
        const keepController = value === undefined

        const encoded = await this.transactionController.prepareSubmittableTransactions(publicKey, transferableBalance, [
            {
                type: SubstrateTransactionType.CANCEL_NOMINATION,
                tip,
                args: {}
            },
            ...(keepController ? [] : [{
                type: SubstrateTransactionType.UNBOND,
                tip,
                args: {
                    value: BigNumber.isBigNumber(value) ? value : new BigNumber(value!)
                }
            }])
        ])

        return [{ encoded }]
    }

    public async prepareChangeValidator(
        publicKey: string,
        tip: string | number | BigNumber,
        targets: string[] | string
    ): Promise<RawSubstrateTransaction[]> {
        const transferableBalance = await this.accountController.getTransferableBalance(publicKey)

        const encoded = await this.transactionController.prepareSubmittableTransactions(publicKey, transferableBalance, [
            {
                type: SubstrateTransactionType.NOMINATE,
                tip,
                args: {
                    targets: isString(targets) ? [targets] : targets
                }
            }
        ])

        return [{ encoded }]
    }

    public async prepareUnbond(
        publicKey: string,
        tip: string | number | BigNumber,
        value: string | number | BigNumber
    ): Promise<RawSubstrateTransaction[]> {
        const transferableBalance = await this.accountController.getTransferableBalance(publicKey)

        const encoded = await this.transactionController.prepareSubmittableTransactions(publicKey, transferableBalance, [
            {
                type: SubstrateTransactionType.UNBOND,
                tip,
                args: {
                    value: BigNumber.isBigNumber(value) ? value : new BigNumber(value!)
                }
            }
        ])

        return [{ encoded }]
    }

    public async prepareRebond(
        publicKey: string,
        tip: string | number | BigNumber,
        value: string | number | BigNumber
    ): Promise<RawSubstrateTransaction[]> {
        const transferableBalance = await this.accountController.getTransferableBalance(publicKey)

        const encoded = await this.transactionController.prepareSubmittableTransactions(publicKey, transferableBalance, [
            {
                type: SubstrateTransactionType.REBOND,
                tip,
                args: {
                    value: BigNumber.isBigNumber(value) ? value : new BigNumber(value!)
                }
            }
        ])

        return [{ encoded }]
    }

    public async prepareBondExtra(
        publicKey: string,
        tip: string | number | BigNumber,
        value: string | number | BigNumber
    ): Promise<RawSubstrateTransaction[]> {
        const transferableBalance = await this.accountController.getTransferableBalance(publicKey)

        const encoded = await this.transactionController.prepareSubmittableTransactions(publicKey, transferableBalance, [
            {
                type: SubstrateTransactionType.BOND_EXTRA,
                tip,
                args: {
                    value: BigNumber.isBigNumber(value) ? value : new BigNumber(value)
                }
            }
        ])

        return [{ encoded }]
    }

    public async prepareWithdrawUnbonded(publicKey: string, tip: string | number | BigNumber): Promise<RawSubstrateTransaction[]> {
        const transferableBalance = await this.accountController.getTransferableBalance(publicKey)

        const encoded = await this.transactionController.prepareSubmittableTransactions(publicKey, transferableBalance, [
            {
                type: SubstrateTransactionType.WITHDRAW_UNBONDED,
                tip,
                args: {}
            }
        ])

        return [{ encoded }]
    }

    public async prepareCollectRewards(
        publicKey: string, 
        tip: string | number | BigNumber,
    ): Promise<RawSubstrateTransaction[]> {
        const transferableBalance = await this.accountController.getTransferableBalance(publicKey)
        const awaitingRewards = await this.accountController.getUnclaimedRewards(publicKey)

        const payoutCalls = await Promise.all(awaitingRewards.map(
            reward => this.transactionController.createTransactionMethod(
                SubstrateTransactionType.COLLECT_PAYOUT,
                {
                    eraIndex: reward.eraIndex,
                    validators: reward.exposures
                }
            )
        ))

        const encoded = await this.transactionController.prepareSubmittableTransactions(publicKey, transferableBalance, [
            {
                type: SubstrateTransactionType.SUBMIT_BATCH,
                tip,
                args: {
                    calls: payoutCalls
                }
            }
        ])

        return [{ encoded }]
    }

    public async estimateMaxDelegationValueFromAddress(address: string): Promise<string> {
        const results = await Promise.all([
            this.accountController.getTransferableBalance(address),
            this.getFutureRequiredTransactions(address, 'delegate')
        ])

        const transferableBalance = results[0]
        const futureTransactions = results[1]

        const feeEstimate = await this.transactionController.estimateTransactionFees(futureTransactions)

        if (!feeEstimate) {
            return Promise.reject('Could not estimate max value.')
        }

        const maxValue = transferableBalance
            .minus(feeEstimate)

        return (maxValue.gte(0) ? maxValue : new BigNumber(0)).toString(10)
    }

    private async getTransactionDetailsFromEncoded(encoded: string): Promise<IAirGapTransaction[]> {
        const txs = this.transactionController.decodeDetails(encoded)

        return txs.map(tx => {
            return tx.transaction.toAirGapTransactions().map(part => ({
                from: [],
                to: [],
                amount: '',
                fee: tx.fee.toString(),
                protocolIdentifier: this.identifier,
                isInbound: false,
                ...part
            }))
        }).reduce((flatten, toFlatten) => flatten.concat(toFlatten), [])
    }

    private async getFutureRequiredTransactions(
        publicKey: string,
        intention: 'check' | 'transfer' | 'delegate'
    ): Promise<[SubstrateTransactionType, any][]> {
        const results = await Promise.all([
            this.accountController.isBonded(publicKey),
            this.accountController.isNominating(publicKey),
            this.accountController.getTransferableBalance(publicKey)
        ])

        const isBonded = results[0]
        const isNominating = results[1]
        const transferableBalance = results[2]

        let requiredTransactions: [SubstrateTransactionType, any][] = []

        if (intention === 'transfer') {
            requiredTransactions.push([SubstrateTransactionType.TRANSFER, {
                to: SubstrateAddress.createPlaceholder(),
                value: transferableBalance
            }])
        }

        if (!isBonded && intention === 'delegate') {
            requiredTransactions.push(
                [SubstrateTransactionType.BOND, {
                    controller: SubstrateAddress.createPlaceholder(),
                    value: transferableBalance,
                    payee: 0
                }],
                [SubstrateTransactionType.NOMINATE, {
                    targets: [SubstrateAddress.createPlaceholder()]
                }],
                [SubstrateTransactionType.CANCEL_NOMINATION, {}],
                [SubstrateTransactionType.UNBOND, {
                    value: transferableBalance
                }],
                [SubstrateTransactionType.WITHDRAW_UNBONDED, {}]
            )
        } else if (isBonded) {
            requiredTransactions.push(
                [SubstrateTransactionType.UNBOND, {
                    value: transferableBalance
                }],
                [SubstrateTransactionType.WITHDRAW_UNBONDED, {}]
            )
        }

        if (isNominating) {
            requiredTransactions.push([SubstrateTransactionType.CANCEL_NOMINATION, {}])
        }

        return requiredTransactions
    }

    public signMessage(message: string, privateKey: Buffer): Promise<string> {
        throw new Error('Method not implemented.');
    }
    
    public verifyMessage(message: string, signature: string, publicKey: Buffer): Promise<boolean> {
        throw new Error('Method not implemented.');
    }
}