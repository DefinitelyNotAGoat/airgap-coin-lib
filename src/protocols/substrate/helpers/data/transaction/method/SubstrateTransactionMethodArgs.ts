import { SubstrateTransactionType } from '../SubstrateTransaction'
import { SCALEType } from '../../scale/type/SCALEType'
import { SCALEDecodeResult, SCALEDecoder } from '../../scale/SCALEDecoder'
import { SCALEAccountId } from '../../scale/type/SCALEAccountId'
import { SCALECompactInt } from '../../scale/type/SCALECompactInt'
import { SCALEEnum } from '../../scale/type/SCALEEnum'
import { SCALEArray } from '../../scale/type/SCALEArray'
import { SubstrateAddress, SubstrateAccountId } from '../../account/SubstrateAddress'
import BigNumber from '../../../../../../dependencies/src/bignumber.js-9.0.0/bignumber'
import { SCALETuple } from '../../scale/type/SCALETuple'
import { SCALEInt } from '../../scale/type/SCALEInt'
import { SubstrateTransactionMethod } from './SubstrateTransactionMethod'
import { SubstratePayee } from '../../staking/SubstratePayee'
import { IAirGapTransaction } from '../../../../../../interfaces/IAirGapTransaction'
import { SubstrateNetwork } from '../../../../SubstrateNetwork'
import { assertFields } from '../../../../../../utils/assert'

interface TransferArgs {
    to: SubstrateAccountId,
    value: number | BigNumber
}

interface BondArgs {
    controller: SubstrateAccountId
    value: number | BigNumber,
    payee: SubstratePayee
}

interface UnbondArgs {
    value: number | BigNumber
}

interface RebondArgs {
    value: number | BigNumber
}

interface BondExtraArgs {
    value: number | BigNumber
}

interface WithdrawUnbondedArgs {

}

interface NominateArgs {
    targets: SubstrateAccountId[]
}

interface StopNominatingArgs {

}

interface PayoutNominatorArgs {
    eraIndex: number | BigNumber
    validators: [SubstrateAccountId, number][]
}

interface SetPayeeArgs {
    payee: SubstratePayee
}

interface SetControllerArgs {
    controller: SubstrateAccountId
}

interface SubmitBatchArgs {
    calls: SubstrateTransactionMethod[]
}

export abstract class SubstrateTransactionMethodArgsFactory<T> {
    public static create(network: SubstrateNetwork, type: SubstrateTransactionType, args: any): SubstrateTransactionMethodArgsFactory<any> {
        switch (type) {
            case SubstrateTransactionType.TRANSFER:
                assertFields('transfer', args, 'to', 'value')
                return new TransferArgsFactory(network, args)
            case SubstrateTransactionType.BOND:
                assertFields('bond', args, 'controller', 'value', 'payee')
                return new BondArgsFactory(network, args)
            case SubstrateTransactionType.UNBOND:
                assertFields('unbond', args, 'value')
                return new UnbondArgsFactory(network, args)
            case SubstrateTransactionType.REBOND:
                assertFields('rebond', args, 'value')
                return new RebondArgsFactory(network, args)
            case SubstrateTransactionType.BOND_EXTRA:
                assertFields('bondExtra', args, 'value')
                return new BondExtraArgsFactory(network, args)
            case SubstrateTransactionType.WITHDRAW_UNBONDED:
                return new WithdrawUnbondedArgsFactory(network, args)
            case SubstrateTransactionType.NOMINATE:
                assertFields('nominate', args, 'targets')
                return new NominateArgsFactory(network, args)
            case SubstrateTransactionType.CANCEL_NOMINATION:
                return new StopNominatingArgsFactory(network, args)
            case SubstrateTransactionType.COLLECT_PAYOUT:
                assertFields('collectPayout', args, 'eraIndex', 'validators')
                return new PayoutNominatorArgsFactory(network, args)
            case SubstrateTransactionType.SET_PAYEE:
                assertFields('setPayee', args, 'payee')
                return new SetPayeeArgsFactory(network, args)
            case SubstrateTransactionType.SET_CONTROLLER:
                assertFields('setController', args, 'controller')
                return new SetControllerArgsFactory(network, args)
            case SubstrateTransactionType.SUBMIT_BATCH:
                assertFields('submitBatch', args, 'calls')
                return new SubmitBatchArgsFactory(network, args)
        }        
    }

    protected constructor(protected readonly network: SubstrateNetwork, protected readonly args: T) {}

    public abstract createFields(): [string, SCALEType][]
    public abstract createToAirGapTransactionParts(): () => Partial<IAirGapTransaction>[]
}

export abstract class SubstrateTransactionMethodArgsDecoder<T> {
    public static create(type: SubstrateTransactionType): SubstrateTransactionMethodArgsDecoder<any> {
        switch (type) {
            case SubstrateTransactionType.TRANSFER:
                return new TransferArgsDecoder()
            case SubstrateTransactionType.BOND:
                return new BondArgsDecoder()
            case SubstrateTransactionType.UNBOND:
                return new UnbondArgsDecoder()
            case SubstrateTransactionType.REBOND:
                return new RebondArgsDecoder()
            case SubstrateTransactionType.BOND_EXTRA:
                return new BondExtraArgsDecoder()
            case SubstrateTransactionType.WITHDRAW_UNBONDED:
                return new WithdrawUnbondedArgsDecoder()
            case SubstrateTransactionType.NOMINATE:
                return new NominateArgsDecoder()
            case SubstrateTransactionType.CANCEL_NOMINATION:
                return new StopNominatingArgsDecoder()
            case SubstrateTransactionType.COLLECT_PAYOUT:
                return new PayoutNominatorArgsDecoder()
            case SubstrateTransactionType.SET_PAYEE:
                return new SetPayeeArgsDecoder()
            case SubstrateTransactionType.SET_CONTROLLER:
                return new SetControllerArgsDecoder()
            case SubstrateTransactionType.SUBMIT_BATCH:
                return new SubmitBatchArgsDecoder()
        }
    }

    public decode(network: SubstrateNetwork, raw: string): SCALEDecodeResult<T> {
        const decoder = new SCALEDecoder(network, raw)
        return this._decode(decoder)
    }

    protected abstract _decode(decoder: SCALEDecoder): SCALEDecodeResult<T>
}

class TransferArgsFactory extends SubstrateTransactionMethodArgsFactory<TransferArgs> {
    public createFields(): [string, SCALEType][] {
        return [
            ['destination', SCALEAccountId.from(this.args.to, this.network)],
            ['value', SCALECompactInt.from(this.args.value)]
        ]
    }

    public createToAirGapTransactionParts(): () => Partial<IAirGapTransaction>[] {
        return () => [{
            to: [SubstrateAddress.from(this.args.to, this.network).toString()],
            amount: this.args.value.toString()
        }]
    }
}

class TransferArgsDecoder extends SubstrateTransactionMethodArgsDecoder<TransferArgs> {
    protected _decode(decoder: SCALEDecoder): SCALEDecodeResult<TransferArgs> {
        const destination = decoder.decodeNextAccountId()
        const value = decoder.decodeNextCompactInt()

        return {
            bytesDecoded: destination.bytesDecoded + value.bytesDecoded,
            decoded: {
                to: destination.decoded.toString(),
                value: value.decoded.value
            }
        }
    }
}

class BondArgsFactory extends SubstrateTransactionMethodArgsFactory<BondArgs> {
    public createFields(): [string, SCALEType][] {
        return [
            ['controller', SCALEAccountId.from(this.args.controller, this.network)],
            ['value', SCALECompactInt.from(this.args.value)],
            ['payee', SCALEEnum.from(this.args.payee)]
        ]
    }
    public createToAirGapTransactionParts(): () => Partial<IAirGapTransaction>[] {
        return () => [{
            to: [SubstrateAddress.from(this.args.controller, this.network).toString()],
            amount: this.args.value.toString()
        }]
    }
}

class BondArgsDecoder extends SubstrateTransactionMethodArgsDecoder<BondArgs> {
    protected _decode(decoder: SCALEDecoder): SCALEDecodeResult<BondArgs> {
        const controller = decoder.decodeNextAccountId()
        const value = decoder.decodeNextCompactInt()
        const payee = decoder.decodeNextEnum(value => SubstratePayee[SubstratePayee[value]])

        return {
            bytesDecoded: controller.bytesDecoded + value.bytesDecoded + payee.bytesDecoded,
            decoded: {
                controller: controller.decoded.toString(),
                value: value.decoded.value,
                payee: payee.decoded.value
            }
        }
    }
}

class UnbondArgsFactory extends SubstrateTransactionMethodArgsFactory<UnbondArgs> {
    public createFields(): [string, SCALEType][] {
        return [
            ['value', SCALECompactInt.from(this.args.value)]
        ]
    }
    public createToAirGapTransactionParts(): () => Partial<IAirGapTransaction>[] {
        return () => [{
            amount: this.args.value.toString() 
        }]
    }
}

class UnbondArgsDecoder extends SubstrateTransactionMethodArgsDecoder<UnbondArgs> {
    protected _decode(decoder: SCALEDecoder): SCALEDecodeResult<UnbondArgs> {
        const value = decoder.decodeNextCompactInt()

        return {
            bytesDecoded: value.bytesDecoded,
            decoded: {
                value: value.decoded.value
            }
        }
    }
}

class RebondArgsFactory extends SubstrateTransactionMethodArgsFactory<RebondArgs> {
    public createFields(): [string, SCALEType][] {
        return [
            ['value', SCALECompactInt.from(this.args.value)]
        ]
    }
    public createToAirGapTransactionParts(): () => Partial<IAirGapTransaction>[] {
        return () => [{
            amount: this.args.value.toString() 
        }]
    }
}

class RebondArgsDecoder extends SubstrateTransactionMethodArgsDecoder<RebondArgs> {
    protected _decode(decoder: SCALEDecoder): SCALEDecodeResult<RebondArgs> {
        const value = decoder.decodeNextCompactInt()

        return {
            bytesDecoded: value.bytesDecoded,
            decoded: {
                value: value.decoded.value
            }
        }
    }
}

class BondExtraArgsFactory extends SubstrateTransactionMethodArgsFactory<BondExtraArgs> {
    public createFields(): [string, SCALEType][] {
        return [
            ['value', SCALECompactInt.from(this.args.value)]
        ]
    }
    public createToAirGapTransactionParts(): () => Partial<IAirGapTransaction>[] {
        return () => [{
            amount: this.args.value.toString() 
        }]
    }
}

class BondExtraArgsDecoder extends SubstrateTransactionMethodArgsDecoder<BondExtraArgs> {
    protected _decode(decoder: SCALEDecoder): SCALEDecodeResult<BondExtraArgs> {
        const value = decoder.decodeNextCompactInt()

        return {
            bytesDecoded: value.bytesDecoded,
            decoded: {
                value: value.decoded.value
            }
        }
    }
}

class WithdrawUnbondedArgsFactory extends SubstrateTransactionMethodArgsFactory<WithdrawUnbondedArgs> {
    public createFields(): [string, SCALEType][] {
        return []
    }
    public createToAirGapTransactionParts(): () => Partial<IAirGapTransaction>[] {
        return () => []
    }
}

class WithdrawUnbondedArgsDecoder extends SubstrateTransactionMethodArgsDecoder<WithdrawUnbondedArgs> {
    protected _decode(decoder: SCALEDecoder): SCALEDecodeResult<WithdrawUnbondedArgs> {
        return {
            bytesDecoded: 0,
            decoded: {}
        }
    }
}

class NominateArgsFactory extends SubstrateTransactionMethodArgsFactory<NominateArgs> {
    public createFields(): [string, SCALEType][] {
        return [
            ['targets', SCALEArray.from(this.args.targets.map(target => SCALEAccountId.from(target, this.network)))]
        ]
    }
    public createToAirGapTransactionParts(): () => Partial<IAirGapTransaction>[] {
        return () => [{
            to: this.args.targets.map(target => SubstrateAddress.from(target, this.network).toString())
        }]
    }
}

class NominateArgsDecoder extends SubstrateTransactionMethodArgsDecoder<NominateArgs> {
    protected _decode(decoder: SCALEDecoder): SCALEDecodeResult<NominateArgs> {
        const targets = decoder.decodeNextArray(SCALEAccountId.decode)

        return {
            bytesDecoded: targets.bytesDecoded,
            decoded: {
                targets: targets.decoded.elements.map(target => target.toString())
            }
        }
    }
}

class StopNominatingArgsFactory extends SubstrateTransactionMethodArgsFactory<StopNominatingArgs> {
    public createFields(): [string, SCALEType][] {
        return []
    }
    public createToAirGapTransactionParts(): () => Partial<IAirGapTransaction>[] {
        return () => []
    }
}

class StopNominatingArgsDecoder extends SubstrateTransactionMethodArgsDecoder<StopNominatingArgs> {
    protected _decode(decoder: SCALEDecoder): SCALEDecodeResult<StopNominatingArgs> {
        return {
            bytesDecoded: 0,
            decoded: {}
        }
    }
}

class PayoutNominatorArgsFactory extends SubstrateTransactionMethodArgsFactory<PayoutNominatorArgs> {
    public createFields(): [string, SCALEType][] {
        return [
            ['eraIndex', SCALEInt.from(this.args.eraIndex, 32)],
            ['validators', SCALEArray.from(
                this.args.validators.map(
                    ([accountId, index]) => SCALETuple.from(SCALEAccountId.from(accountId, this.network), SCALEInt.from(index, 32))
                )
            )]
        ]
    }
    public createToAirGapTransactionParts(): () => Partial<IAirGapTransaction>[] {
        return () => []
    }
}

class PayoutNominatorArgsDecoder extends SubstrateTransactionMethodArgsDecoder<PayoutNominatorArgs> {
    protected _decode(decoder: SCALEDecoder): SCALEDecodeResult<PayoutNominatorArgs> {
        const eraIndex = decoder.decodeNextInt(32)
        const validators = decoder.decodeNextArray((network, hex) => 
            SCALETuple.decode(
                network,
                hex, 
                SCALEAccountId.decode,
                (_, second) => SCALEInt.decode(second, 32)
            )
        )

        return {
            bytesDecoded: eraIndex.bytesDecoded + validators.bytesDecoded,
            decoded: {
                eraIndex: eraIndex.decoded.value,
                validators: validators.decoded.elements.map(element => [element.first.address, element.second.toNumber()])
            }
        }
    }
}

class SetPayeeArgsFactory extends SubstrateTransactionMethodArgsFactory<SetPayeeArgs> {
    public createFields(): [string, SCALEType][] {
        return [
            ['payee', SCALEEnum.from(this.args.payee)]
        ]
    }
    public createToAirGapTransactionParts(): () => Partial<IAirGapTransaction>[] {
        return () => []
    }
}

class SetPayeeArgsDecoder extends SubstrateTransactionMethodArgsDecoder<SetPayeeArgs> {
    protected _decode(decoder: SCALEDecoder): SCALEDecodeResult<SetPayeeArgs> {
        const payee = decoder.decodeNextEnum(value => SubstratePayee[SubstratePayee[value]])

        return {
            bytesDecoded: payee.bytesDecoded,
            decoded: {
                payee: payee.decoded.value
            }
        }
    }
}

class SetControllerArgsFactory extends SubstrateTransactionMethodArgsFactory<SetControllerArgs> {
    public createFields(): [string, SCALEType][] {
        return [
            ['controller', SCALEAccountId.from(this.args.controller, this.network)]
        ]
    }
    public createToAirGapTransactionParts(): () => Partial<IAirGapTransaction>[] {
        return () => [{
            to: [SubstrateAddress.from(this.args.controller, this.network).toString()]
        }]
    }
}

class SetControllerArgsDecoder extends SubstrateTransactionMethodArgsDecoder<SetControllerArgs> {
    protected _decode(decoder: SCALEDecoder): SCALEDecodeResult<SetControllerArgs> {
        const controller = decoder.decodeNextAccountId()

        return {
            bytesDecoded: controller.bytesDecoded,
            decoded: {
                controller: controller.decoded.toString()
            }
        }
    }
}

class SubmitBatchArgsFactory extends SubstrateTransactionMethodArgsFactory<SubmitBatchArgs> {
    public createFields(): [string, SCALEType][] {
        return [
            ['calls', SCALEArray.from(this.args.calls)]
        ]
    }
    public createToAirGapTransactionParts(): () => Partial<IAirGapTransaction>[] {
        return () => this.args.calls
            .map(call => call.toAirGapTransactionParts())
            .reduce((flatten, toFlatten) => flatten.concat(toFlatten), [])
    }
}

class SubmitBatchArgsDecoder extends SubstrateTransactionMethodArgsDecoder<SubmitBatchArgs> {
    protected _decode(decoder: SCALEDecoder): SCALEDecodeResult<SubmitBatchArgs> {
        // temporary fixed type
        const calls = decoder.decodeNextArray((network, hex) => 
            SubstrateTransactionMethod.decode(network, SubstrateTransactionType.COLLECT_PAYOUT, hex)
        )

        return {
            bytesDecoded: calls.bytesDecoded,
            decoded: {
                calls: calls.decoded.elements
            }
        }
    }
}