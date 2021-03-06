import { SubstrateNodeClient } from "./node/SubstrateNodeClient";
import { SubstrateTransaction, SubstrateTransactionType } from './data/transaction/SubstrateTransaction'
import { SubstrateTransactionPayload } from './data/transaction/SubstrateTransactionPayload'
import { waitReady, sr25519Sign } from '@polkadot/wasm-crypto'
import { blake2bAsBytes } from '../../../utils/blake2b'
import BigNumber from '../../../dependencies/src/bignumber.js-9.0.0/bignumber'
import { SCALEEnum } from './data/scale/type/SCALEEnum'
import { SCALECompactInt } from './data/scale/type/SCALECompactInt'
import { SCALEBytes } from './data/scale/type/SCALEBytes'
import { SCALEArray } from './data/scale/type/SCALEArray'
import { SCALEDecoder } from './data/scale/SCALEDecoder'
import { SubstrateAddress, SubstrateAccountId } from './data/account/SubstrateAddress'
import { SubstrateTransactionMethod } from './data/transaction/method/SubstrateTransactionMethod'
import { SubstrateNetwork } from '../SubstrateNetwork'

interface SubstrateTransactionDetails {
    fee: BigNumber
    transaction: SubstrateTransaction
    payload: SubstrateTransactionPayload
}

interface SubstrateTransactionConfig {
    type: SubstrateTransactionType
    tip: string | number | BigNumber
    args: any
}

export class SubstrateTransactionController {
    constructor(
        readonly network: SubstrateNetwork,
        readonly nodeClient: SubstrateNodeClient
    ) {}

    public async prepareSubmittableTransactions(
        accountId: SubstrateAccountId, 
        available: BigNumber | string,
        txConfig: SubstrateTransactionConfig[]
    ): Promise<string> {
        const accountInfo = await this.nodeClient.getAccountInfo(SubstrateAddress.from(accountId, this.network))

        if (!accountInfo) {
            return Promise.reject('Could not fetch all necessary data')
        }

        const nonce = accountInfo.nonce.value
        const txs = await Promise.all(
            txConfig.map((tx, index) => this.prepareTransactionDetails(tx.type, accountId, tx.tip, nonce.plus(index), tx.args))
        )

        const totalFee = txs.map(tx => tx.fee).reduce((total, next) => total.plus(next), new BigNumber(0))
        
        if (new BigNumber(available).lt(totalFee)) {
            throw new Error('Not enough balance')
        }

        return this.encodeDetails(txs)
    }

    public async createTransaction(
        type: SubstrateTransactionType, 
        accountId: SubstrateAccountId, 
        tip: string | number | BigNumber = 0, 
        args: any = {},
        chainHeight: number | BigNumber = 1,
        nonce: number | BigNumber = 0,
    ): Promise<SubstrateTransaction> {
        const methodId = await this.nodeClient.getTransactionMetadata(type)

        return SubstrateTransaction.create(this.network, type, {
            from: accountId,
            tip: BigNumber.isBigNumber(tip) ? tip : new BigNumber(tip),
            methodId,
            args,
            era: { chainHeight },
            nonce
        })
    }

    public async createTransactionMethod(
        type: SubstrateTransactionType,
        args: any = {}
    ): Promise<SubstrateTransactionMethod> {
        const methodId = await this.nodeClient.getTransactionMetadata(type)

        return SubstrateTransactionMethod.create(this.network, type, methodId.moduleIndex, methodId.callIndex, args)
    }

    public async signTransaction(privateKey: Buffer, transaction: SubstrateTransaction, payload: SubstrateTransactionPayload): Promise<SubstrateTransaction> {
        const signature = await this.signPayload(privateKey, transaction.signer.asBytes(), payload.encode())
        return SubstrateTransaction.fromTransaction(transaction, { signature })
    }

    public encodeDetails(txs: SubstrateTransactionDetails[]): string {
        const bytesEncoded = txs.map(tx => {
            const scaleTypes = SCALEEnum.from(tx.transaction.type)
            const scaleFee = SCALECompactInt.from(tx.fee)
            
            return SCALEBytes.from(scaleTypes.encode() + scaleFee.encode() + tx.transaction.encode() + tx.payload.encode())
        })
    
        return SCALEArray.from(bytesEncoded).encode()
    }

    public decodeDetails(serialized: string): SubstrateTransactionDetails[] {
        const decoder = new SCALEDecoder(this.network, serialized)
    
        const encodedTxs = decoder.decodeNextArray((_, hex) => SCALEBytes.decode(hex)).decoded.elements
            .map(bytesEncoded => bytesEncoded.bytes.toString('hex'))
    
        return encodedTxs.map(encodedTx => {
            const txDecoder = new SCALEDecoder(this.network, encodedTx)
    
            const type = txDecoder.decodeNextEnum(hex => SubstrateTransactionType[SubstrateTransactionType[hex]])
            const fee = txDecoder.decodeNextCompactInt()
            const transaction = txDecoder.decodeNextObject((network, hex) => SubstrateTransaction.decode(network, type.decoded.value, hex))
            const payload = txDecoder.decodeNextObject((network, hex) => SubstrateTransactionPayload.decode(network, type.decoded.value, hex))
    
            return {
                fee: fee.decoded.value,
                transaction: transaction.decoded,
                payload: payload.decoded
            }
        })
    }

    public async calculateTransactionFee(transaction: SubstrateTransaction): Promise<BigNumber | null> {
        const partialEstimate = await this.nodeClient.getTransferFeeEstimate(transaction.encode())

        if (partialEstimate) {
            this.nodeClient.saveLastFee(transaction.type, partialEstimate)
        }

        return partialEstimate?.plus(transaction.tip.value) || null
    }

    public async estimateTransactionFees(transationTypes: [SubstrateTransactionType, any][]): Promise<BigNumber | null> {
        const fees = await Promise.all(transationTypes
            .map(([type, args]) => [
                type, 
                args, 
                this.nodeClient.getSavedLastFee(type, 'largest')
            ] as [SubstrateTransactionType, any, BigNumber])
            .map(async ([type, args, fee]) => fee 
                ? fee 
                : this.calculateTransactionFee(await this.createTransaction(type, SubstrateAddress.createPlaceholder(), 0, args))
            )
        )

        if (fees.some(fee => fee === null)) {
            return Promise.reject('Could not estimate transaction fees.')
        }

        const safetyFactor = 1.2
        return fees.reduce((sum: BigNumber, next) => sum.plus(next!), new BigNumber(0)).multipliedBy(safetyFactor)
    }

    private async prepareTransactionDetails(
        type: SubstrateTransactionType, 
        accountId: SubstrateAccountId, 
        tip: string | number | BigNumber,
        nonce: number | BigNumber,
        args: any = {}
    ): Promise<SubstrateTransactionDetails> {
        const chainHeight = await this.nodeClient.getCurrentHeight()

        const results = await Promise.all([
            this.createTransaction(type, accountId, tip, args, chainHeight, nonce),
            this.nodeClient.getLastBlockHash(),
            this.nodeClient.getFirstBlockHash(),
            this.nodeClient.getSpecVersion(),
        ])

        if (results.some(result => result === null)) {
            return Promise.reject('Could not fetch all necessary data.')
        }

        const transaction = results[0]!

        const fee = await this.calculateTransactionFee(transaction)
        if (!fee) {
            return Promise.reject('Could not fetch all necessary data.')
        }

        const lastHash = results[1]!
        const genesisHash = results[2]!
        const specVersion = results[3]!

        const payload = SubstrateTransactionPayload.create(transaction, {
            specVersion,
            genesisHash,
            lastHash
        })

        return {
            fee,
            transaction,
            payload
        }
    }

    private async signPayload(privateKey: Buffer, publicKey: Buffer, payload: string): Promise<Uint8Array> {
        await waitReady()
            
        const payloadBuffer = Buffer.from(payload, 'hex')
        const message = payloadBuffer.length > 256 ? blake2bAsBytes(payloadBuffer, 256) : payloadBuffer
    
        return sr25519Sign(publicKey, privateKey, message)
    }
}