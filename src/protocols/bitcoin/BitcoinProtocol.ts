import * as assert from 'assert'

import axios from '../../dependencies/src/axios-0.19.0/index'
import BigNumber from '../../dependencies/src/bignumber.js-9.0.0/bignumber'
import * as bitcoinJS from '../../dependencies/src/bitgo-utxo-lib-5d91049fd7a988382df81c8260e244ee56d57aac/src/index'
import { IAirGapSignedTransaction } from '../../interfaces/IAirGapSignedTransaction'
import { IAirGapTransaction } from '../../interfaces/IAirGapTransaction'
import { Network } from '../../networks'
import { UnsignedTransaction } from '../../serializer/schemas/definitions/transaction-sign-request'
import { SignedBitcoinTransaction } from '../../serializer/schemas/definitions/transaction-sign-response-bitcoin'
import { RawBitcoinTransaction } from '../../serializer/types'
import { CurrencyUnit, FeeDefaults, ICoinProtocol } from '../ICoinProtocol'
import { mnemonicToSeed } from '../../dependencies/src/bip39-2.5.0/index'

const DUST_AMOUNT: number = 50

export class BitcoinProtocol implements ICoinProtocol {
  public symbol: string = 'BTC'
  public name: string = 'Bitcoin'
  public marketSymbol: string = 'btc'

  public feeSymbol: string = 'btc'

  public subProtocols = []

  public feeDefaults: FeeDefaults = {
    low: '0.00002',
    medium: '0.00004',
    high: '0.00005'
  }
  public decimals: number = 8
  public feeDecimals: number = 8
  public identifier: string = 'btc'
  public units: CurrencyUnit[] = [
    {
      unitSymbol: 'BTC',
      factor: '1'
    },
    {
      unitSymbol: 'mBTC',
      factor: '0.0001'
    },
    {
      unitSymbol: 'Satoshi',
      factor: '0.00000001'
    }
  ]

  public supportsHD: boolean = true

  public standardDerivationPath: string = `m/44'/0'/0'`

  public addressIsCaseSensitive: boolean = true
  public addressValidationPattern: string = '^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$'
  public addressPlaceholder: string = '1ABC...'

  public blockExplorer: string = 'https://live.blockcypher.com/btc'

  public network: any // TODO: fix type definition
  public baseApiUrl: string
  public bitcoinJSLib: any

  constructor(network: Network = bitcoinJS.networks.bitcoin, baseApiUrl: string = 'https://insight.bitpay.com', bitcoinJSLib = bitcoinJS) {
    this.network = network
    this.baseApiUrl = baseApiUrl
    this.bitcoinJSLib = bitcoinJSLib
  }

  public async getBlockExplorerLinkForAddress(address: string): Promise<string> {
    return `${this.blockExplorer}/address/{{address}}/`.replace('{{address}}', address)
  }

  public async getBlockExplorerLinkForTxId(txId: string): Promise<string> {
    return `${this.blockExplorer}/tx/{{txId}}/`.replace('{{txId}}', txId)
  }

  public getPublicKeyFromMnemonic(mnemonic: string, derivationPath: string, password?: string): Promise<string> {
    const secret = mnemonicToSeed(mnemonic, password)
    return this.getPublicKeyFromHexSecret(secret, derivationPath)
  }
  
  public getPrivateKeyFromMnemonic(mnemonic: string, derivationPath: string, password?: string): Promise<Buffer> {
    const secret = mnemonicToSeed(mnemonic, password)
    return this.getPrivateKeyFromHexSecret(secret, derivationPath)
  }

  public getExtendedPrivateKeyFromMnemonic(mnemonic: string, derivationPath: string, password?: string): Promise<string> {
    const secret = mnemonicToSeed(mnemonic, password)
    return this.getExtendedPrivateKeyFromHexSecret(secret, derivationPath)
  }

  public async getPublicKeyFromHexSecret(secret: string, derivationPath: string): Promise<string> {
    const bitcoinNode = this.bitcoinJSLib.HDNode.fromSeedHex(secret, this.network)

    return bitcoinNode
      .derivePath(derivationPath)
      .neutered()
      .toBase58()
  }

  public async getPrivateKeyFromHexSecret(secret: string, derivationPath: string): Promise<Buffer> {
    const bitcoinNode = this.bitcoinJSLib.HDNode.fromSeedHex(secret, this.network)

    return bitcoinNode.derivePath(derivationPath).keyPair.d.toBuffer(32)
  }

  public async getExtendedPrivateKeyFromHexSecret(secret: string, derivationPath: string): Promise<string> {
    const bitcoinNode = this.bitcoinJSLib.HDNode.fromSeedHex(secret, this.network)

    return bitcoinNode.derivePath(derivationPath).toBase58()
  }

  public async getAddressFromPublicKey(publicKey: string): Promise<string> {
    // broadcaster knows this (both broadcaster and signer)
    return this.bitcoinJSLib.HDNode.fromBase58(publicKey, this.network).getAddress()
  }

  public async getAddressesFromPublicKey(publicKey: string): Promise<string[]> {
    return [await this.getAddressFromPublicKey(publicKey)]
  }

  public getAddressFromExtendedPublicKey(extendedPublicKey: string, visibilityDerivationIndex, addressDerivationIndex) {
    // broadcaster knows this (both broadcaster and signer)
    return this.bitcoinJSLib.HDNode.fromBase58(extendedPublicKey, this.network)
      .derive(visibilityDerivationIndex)
      .derive(addressDerivationIndex)
      .getAddress()
  }

  public getAddressesFromExtendedPublicKey(
    extendedPublicKey: string,
    visibilityDerivationIndex: number,
    addressCount: number,
    offset: number
  ): Promise<string[]> {
    // broadcaster knows this (both broadcaster and signer)
    const node = this.bitcoinJSLib.HDNode.fromBase58(extendedPublicKey, this.network)
    const generatorArray = Array.from(new Array(addressCount), (x, i) => i + offset)

    return Promise.all(
      generatorArray.map(x =>
        node
          .derive(visibilityDerivationIndex)
          .derive(x)
          .getAddress()
      )
    )
  }

  public async signWithPrivateKey(privateKey: Buffer, transaction: RawBitcoinTransaction): Promise<IAirGapSignedTransaction> {
    const transactionBuilder = new this.bitcoinJSLib.TransactionBuilder(this.network)

    for (const input of transaction.ins) {
      transactionBuilder.addInput(input.txId, input.vout)
    }

    for (const output of transaction.outs) {
      if (output.isChange) {
        const generatedChangeAddress: string = await this.getAddressFromPublicKey(privateKey.toString('hex'))
        if (generatedChangeAddress !== output.recipient) {
          throw new Error('Change address could not be verified.')
        }
      }

      transactionBuilder.addOutput(output.recipient, new BigNumber(output.value).toNumber())
    }

    for (let i = 0; i < transaction.ins.length; i++) {
      transactionBuilder.sign(i, privateKey)
    }

    return transactionBuilder.build().toHex()
  }

  public async signWithExtendedPrivateKey(extendedPrivateKey: string, transaction: RawBitcoinTransaction): Promise<string> {
    const transactionBuilder = new this.bitcoinJSLib.TransactionBuilder(this.network)
    const node = this.bitcoinJSLib.HDNode.fromBase58(extendedPrivateKey, this.network)

    for (const input of transaction.ins) {
      transactionBuilder.addInput(input.txId, input.vout)
    }

    const changeAddressBatchSize: number = 10
    const changeAddressMaxAddresses: number = 500

    for (const output of transaction.outs) {
      let changeAddressIsValid: boolean = false
      if (output.isChange) {
        if (output.derivationPath) {
          const generatedChangeAddress: string[] = await this.getAddressesFromExtendedPublicKey(
            extendedPrivateKey,
            1,
            1,
            parseInt(output.derivationPath, 10)
          )
          changeAddressIsValid = generatedChangeAddress.includes(output.recipient)
        } else {
          for (let x = 0; x < changeAddressMaxAddresses; x += changeAddressBatchSize) {
            const addresses: string[] = await this.getAddressesFromExtendedPublicKey(extendedPrivateKey, 1, changeAddressBatchSize, x)
            if (addresses.indexOf(output.recipient) >= 0) {
              changeAddressIsValid = true
              x = changeAddressMaxAddresses
            }
          }
        }
        if (!changeAddressIsValid) {
          throw new Error('Change address could not be verified.')
        }
      }
      transactionBuilder.addOutput(output.recipient, new BigNumber(output.value).toNumber())
    }

    for (let i = 0; i < transaction.ins.length; i++) {
      transactionBuilder.sign(i, node.derivePath(transaction.ins[i].derivationPath))
    }

    return transactionBuilder.build().toHex()
  }

  public async getTransactionDetails(unsignedTx: UnsignedTransaction): Promise<IAirGapTransaction[]> {
    // out of public information (both broadcaster and signer)
    const transaction = unsignedTx.transaction as RawBitcoinTransaction

    let feeCalculator = new BigNumber(0)

    for (const txIn of transaction.ins) {
      feeCalculator = feeCalculator.plus(new BigNumber(txIn.value))
    }

    for (const txOut of transaction.outs) {
      feeCalculator = feeCalculator.minus(new BigNumber(txOut.value))
    }

    return [
      {
        from: transaction.ins.map(obj => obj.address),
        to: transaction.outs.filter(obj => !obj.isChange).map(obj => obj.recipient),
        amount: transaction.outs
          .filter(obj => !obj.isChange)
          .map(obj => new BigNumber(obj.value))
          .reduce((accumulator, currentValue) => accumulator.plus(currentValue))
          .toString(10),
        fee: feeCalculator.toString(10),
        protocolIdentifier: this.identifier,
        isInbound: false,
        transactionDetails: unsignedTx.transaction
      }
    ]
  }

  public async getTransactionDetailsFromSigned(signedTx: SignedBitcoinTransaction): Promise<IAirGapTransaction[]> {
    const tx: IAirGapTransaction = {
      to: [] as string[],
      from: signedTx.from,
      amount: signedTx.amount,
      fee: signedTx.fee,
      protocolIdentifier: this.identifier,
      isInbound: false,
      transactionDetails: signedTx.transaction
    }

    const bitcoinTx = this.bitcoinJSLib.Transaction.fromHex(signedTx.transaction)
    bitcoinTx.outs.forEach(output => {
      const address = this.bitcoinJSLib.address.fromOutputScript(output.script, this.network)
      // only works if one output is target and rest is change, but this way we can filter out change addresses
      if (new BigNumber(output.value).isEqualTo(signedTx.amount)) {
        tx.to.push(address)
      }
    })

    return [tx]
  }

  public async getBalanceOfAddresses(addresses: string[]): Promise<string> {
    const response = await axios.get(`${this.baseApiUrl}/api/addrs/${addresses.join(',')}/utxo`, { responseType: 'json' })

    const utxos = response.data
    let valueAccumulator: BigNumber = new BigNumber(0)
    for (const utxo of utxos) {
      valueAccumulator = valueAccumulator.plus(new BigNumber(utxo.satoshis))
    }

    return valueAccumulator.toString(10)
  }

  public async getBalanceOfPublicKey(publicKey: string): Promise<string> {
    const address: string = await this.getAddressFromPublicKey(publicKey)

    return this.getBalanceOfAddresses([address])
  }

  public async getBalanceOfExtendedPublicKey(extendedPublicKey: string, offset: number = 0): Promise<string> {
    const derivedAddresses: string[][] = []
    const internalAddresses = await this.getAddressesFromExtendedPublicKey(extendedPublicKey, 1, 20, offset)
    const externalAddresses = await this.getAddressesFromExtendedPublicKey(extendedPublicKey, 0, 20, offset)
    derivedAddresses.push(internalAddresses) // we don't add the last one
    derivedAddresses.push(externalAddresses) // we don't add the last one to make change address possible

    const { data: utxos } = await axios.get(this.baseApiUrl + '/api/addrs/' + derivedAddresses.join(',') + '/utxo', {
      responseType: 'json'
    })

    let valueAccumulator: BigNumber = new BigNumber(0)
    for (const utxo of utxos) {
      valueAccumulator = valueAccumulator.plus(utxo.satoshis)
    }

    const { data: transactions } = await axios.get(this.baseApiUrl + '/api/addrs/' + derivedAddresses.join(',') + '/txs?from=0&to=1', {
      responseType: 'json'
    })

    if (transactions.items.length > 0) {
      const value = await this.getBalanceOfExtendedPublicKey(extendedPublicKey, offset + 100)

      return valueAccumulator.plus(value).toString(10)
    } else {
      return valueAccumulator.toString(10)
    }
  }

  public async getAvailableBalanceOfAddresses(addresses: string[]): Promise<string> {
    return this.getBalanceOfAddresses(addresses)
  }

  public async estimateMaxTransactionValueFromExtendedPublicKey(extendedPublicKey: string, fee: string): Promise<string> {
    const balance = await this.getBalanceOfExtendedPublicKey(extendedPublicKey)
    return this.estimateMaxTransactionValue(new BigNumber(balance), new BigNumber(fee)).toFixed()
  }

  public async estimateMaxTransactionValueFromPublicKey(publicKey: string, fee: string): Promise<string> {
    const balance = await this.getBalanceOfPublicKey(publicKey)
    return this.estimateMaxTransactionValue(new BigNumber(balance), new BigNumber(fee)).toFixed()
  }

  public async prepareTransactionFromExtendedPublicKey(
    extendedPublicKey: string,
    offset: number,
    recipients: string[],
    values: string[],
    fee: string
  ): Promise<RawBitcoinTransaction> {
    const wrappedValues: BigNumber[] = values.map((value: string) => new BigNumber(value))
    const wrappedFee: BigNumber = new BigNumber(fee)

    const transaction: RawBitcoinTransaction = {
      ins: [],
      outs: []
    }

    if (recipients.length !== wrappedValues.length) {
      throw new Error('recipients do not match values')
    }

    const derivedAddresses: string[] = []
    const internalAddresses = await this.getAddressesFromExtendedPublicKey(extendedPublicKey, 1, 101, offset)
    const externalAddresses = await this.getAddressesFromExtendedPublicKey(extendedPublicKey, 0, 101, offset)
    derivedAddresses.push(...internalAddresses.slice(0, -1)) // we don't add the last one
    derivedAddresses.push(...externalAddresses.slice(0, -1)) // we don't add the last one to make change address possible

    const { data: utxos } = await axios.get(this.baseApiUrl + '/api/addrs/' + derivedAddresses.join(',') + '/utxo', {
      responseType: 'json'
    })

    const totalRequiredBalance: BigNumber = wrappedValues
      .reduce((accumulator: BigNumber, currentValue: BigNumber) => accumulator.plus(currentValue))
      .plus(wrappedFee)
    let valueAccumulator: BigNumber = new BigNumber(0)

    for (const utxo of utxos) {
      valueAccumulator = valueAccumulator.plus(new BigNumber(utxo.satoshis))
      if (derivedAddresses.indexOf(utxo.address) >= 0) {
        transaction.ins.push({
          txId: utxo.txid,
          value: new BigNumber(utxo.satoshis).toString(10),
          vout: utxo.vout,
          address: utxo.address,
          derivationPath:
            externalAddresses.indexOf(utxo.address) >= 0
              ? '0/' + (externalAddresses.indexOf(utxo.address) + offset)
              : '1/' + (internalAddresses.indexOf(utxo.address) + offset)
        })
      }

      if (valueAccumulator.isGreaterThanOrEqualTo(totalRequiredBalance)) {
        break
      }
    }

    if (valueAccumulator.isLessThan(totalRequiredBalance)) {
      const { data: transactions } = await axios.get(this.baseApiUrl + '/api/addrs/' + internalAddresses.join(',') + '/txs?from=0&to=1', {
        responseType: 'json'
      })
      if (transactions.items.length <= 0) {
        throw new Error('not enough balance') // no transactions found on those addresses, probably won't find anything in the next ones
      }

      return this.prepareTransactionFromExtendedPublicKey(extendedPublicKey, offset + 10, recipients, values, fee) // recursion needed to navigate through HD wallet
    }

    // tx.addInput(utxo.txid, utxo.vout)
    for (let i: number = 0; i < recipients.length; i++) {
      transaction.outs.push({
        recipient: recipients[i],
        isChange: false,
        value: wrappedValues[i].toString(10),
        derivationPath: '' // TODO: Remove this as soon as our serializer supports optional properties
      })
      valueAccumulator = valueAccumulator.minus(wrappedValues[i])
      // tx.addOutput(recipients[i], values[i])
    }

    const { data: transactions } = await axios.get(this.baseApiUrl + '/api/addrs/' + internalAddresses.join(',') + '/txs', {
      responseType: 'json'
    })

    let maxIndex: number = -1
    for (const item of transactions.items) {
      for (const vout of item.vout) {
        for (const address of vout.scriptPubKey.addresses) {
          maxIndex = Math.max(maxIndex, internalAddresses.indexOf(address))
        }
      }
    }

    // If the change is considered dust, the transaction will fail.
    // Dust is a variable value around 300-600 satoshis, depending on the configuration.
    // We set a low fee here to not block any transactions, but it might still fail due to "dust".
    const changeValue: BigNumber = valueAccumulator.minus(wrappedFee)
    if (changeValue.isGreaterThan(new BigNumber(DUST_AMOUNT))) {
      const internalAddressIndex: number = Math.min(maxIndex + 1, internalAddresses.length - 1)
      transaction.outs.push({
        recipient: internalAddresses[internalAddressIndex],
        isChange: true,
        value: changeValue.toString(10),
        derivationPath: (internalAddressIndex + offset).toString()
      })
    }
    // tx.addOutput(internalAddresses[maxIndex + 1], valueAccumulator - fee) //this is why we sliced the arrays earlier

    return transaction
  }

  public async prepareTransactionFromPublicKey(
    publicKey: string,
    recipients: string[],
    values: string[],
    fee: string
  ): Promise<RawBitcoinTransaction> {
    const wrappedValues: BigNumber[] = values.map((value: string) => new BigNumber(value))
    const wrappedFee: BigNumber = new BigNumber(fee)

    const transaction: RawBitcoinTransaction = {
      ins: [],
      outs: []
    }

    assert(recipients.length === wrappedValues.length)
    const address = await this.getAddressFromPublicKey(publicKey)

    const { data: utxos } = await axios.get(this.baseApiUrl + '/api/addrs/' + address + '/utxo', { responseType: 'json' })
    const totalRequiredBalance: BigNumber = wrappedValues
      .reduce((accumulator: BigNumber, currentValue: BigNumber) => accumulator.plus(currentValue))
      .plus(wrappedFee)
    let valueAccumulator: BigNumber = new BigNumber(0)
    for (const utxo of utxos) {
      valueAccumulator = valueAccumulator.plus(new BigNumber(utxo.satoshis))
      if (address === utxo.address) {
        transaction.ins.push({
          txId: utxo.txid,
          value: new BigNumber(utxo.satoshis).toString(10),
          vout: utxo.vout,
          address: utxo.address
        })
      }

      if (valueAccumulator.isGreaterThanOrEqualTo(totalRequiredBalance)) {
        break
      }
    }

    if (valueAccumulator.isLessThan(totalRequiredBalance)) {
      throw new Error(`not enough balance, having ${valueAccumulator.toFixed()} of ${totalRequiredBalance.toFixed()}`)
    }

    // tx.addInput(utxo.txid, utxo.vout)
    for (let i: number = 0; i < recipients.length; i++) {
      transaction.outs.push({
        recipient: recipients[i],
        isChange: false,
        value: wrappedValues[i].toString(10)
      })
      valueAccumulator = valueAccumulator.minus(wrappedValues[i])
      // tx.addOutput(recipients[i], values[i])
    }

    // If the change is considered dust, the transaction will fail.
    // Dust is a variable value around 300-600 satoshis, depending on the configuration.
    // We set a low fee here to not block any transactions, but it might still fail due to "dust".
    const changeValue: BigNumber = valueAccumulator.minus(wrappedFee)
    if (changeValue.isGreaterThan(new BigNumber(DUST_AMOUNT))) {
      transaction.outs.push({
        recipient: address,
        isChange: true,
        value: changeValue.toString(10)
      })
    }

    return transaction
  }

  public broadcastTransaction(rawTransaction: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const params = new URLSearchParams() // Fix for axios content-type
      params.append('rawtx', rawTransaction)
      axios
        .post(this.baseApiUrl + '/api/tx/send', params)
        .then(response => {
          const payload = response.data
          resolve(payload.txid)
        })
        .catch(reject)
    })
  }

  public async getTransactionsFromExtendedPublicKey(
    extendedPublicKey: string,
    limit: number,
    offset: number,
    addressOffset = 0
  ): Promise<IAirGapTransaction[]> {
    const derivedAddresses: string[] = []
    derivedAddresses.push(...(await this.getAddressesFromExtendedPublicKey(extendedPublicKey, 1, 100, addressOffset)))
    derivedAddresses.push(...(await this.getAddressesFromExtendedPublicKey(extendedPublicKey, 0, 100, addressOffset)))

    return this.getTransactionsFromAddresses(derivedAddresses, limit, offset)
  }

  public async getTransactionsFromPublicKey(publicKey: string, limit: number, offset: number): Promise<IAirGapTransaction[]> {
    return this.getTransactionsFromAddresses([await this.getAddressFromPublicKey(publicKey)], limit, offset)
  }

  public async getTransactionsFromAddresses(addresses: string[], limit: number, offset: number): Promise<IAirGapTransaction[]> {
    const airGapTransactions: IAirGapTransaction[] = []
    const { data: transactions } = await axios.get(
      this.baseApiUrl + '/api/addrs/' + addresses.join(',') + '/txs?from=' + offset + '&to=' + (offset + limit),
      {
        responseType: 'json'
      }
    )

    for (const transaction of transactions.items) {
      const tempAirGapTransactionFrom: string[] = []
      const tempAirGapTransactionTo: string[] = []
      let tempAirGapTransactionIsInbound: boolean = true

      let amount = new BigNumber(0)

      for (const vin of transaction.vin) {
        if (addresses.indexOf(vin.addr) > -1) {
          tempAirGapTransactionIsInbound = false
        }
        tempAirGapTransactionFrom.push(vin.addr)
        amount = amount.plus(vin.valueSat)
      }

      for (const vout of transaction.vout) {
        if (vout.scriptPubKey.addresses) {
          tempAirGapTransactionTo.push(...vout.scriptPubKey.addresses)
          // If receiving address is our address, and transaction is outbound => our change
          if (this.containsSome(vout.scriptPubKey.addresses, addresses) && !tempAirGapTransactionIsInbound) {
            // remove only if related to this address
            amount = amount.minus(new BigNumber(vout.value).shiftedBy(this.decimals))
          }
          // If receiving address is not ours, and transaction isbound => senders change
          if (!this.containsSome(vout.scriptPubKey.addresses, addresses) && tempAirGapTransactionIsInbound) {
            amount = amount.minus(new BigNumber(vout.value).shiftedBy(this.decimals))
          }
        }
      }

      // deduct fee from amount
      amount = amount.minus(new BigNumber(transaction.fees).shiftedBy(this.feeDecimals))

      const airGapTransaction: IAirGapTransaction = {
        hash: transaction.txid,
        from: tempAirGapTransactionFrom,
        to: tempAirGapTransactionTo,
        isInbound: tempAirGapTransactionIsInbound,
        amount: amount.toString(10),
        fee: new BigNumber(transaction.fees).shiftedBy(this.feeDecimals).toString(10),
        blockHeight: transaction.blockheight,
        protocolIdentifier: this.identifier,
        timestamp: transaction.time
      }

      airGapTransactions.push(airGapTransaction)
    }

    return airGapTransactions
  }

  private containsSome(needles: any[], haystack: any[]): boolean {
    for (const needle of needles) {
      if (haystack.indexOf(needle) > -1) {
        return true
      }
    }

    return false
  }

  public async signMessage(message: string, privateKey: Buffer): Promise<string> {
    return Promise.reject('Message signing not implemented')
  }

  public async verifyMessage(message: string, signature: string, publicKey: Buffer): Promise<boolean> {
    return Promise.reject('Message verification not implemented')
  }

  private estimateMaxTransactionValue(balance: BigNumber, fee: BigNumber): BigNumber {
    let amountWithoutFees = balance.minus(fee)
    if (amountWithoutFees.isNegative()) {
      amountWithoutFees = new BigNumber(0)
    }
    return amountWithoutFees
  }
}
