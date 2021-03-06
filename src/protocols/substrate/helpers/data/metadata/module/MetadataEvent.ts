import { SCALEClass } from '../../scale/type/SCALEClass'
import { SCALEString } from '../../scale/type/SCALEString'
import { SCALEDecodeResult } from '../../scale/SCALEDecoder'
import { SCALEArray } from '../../scale/type/SCALEArray'
import { SCALEDecoder } from '../../scale/SCALEDecoder'
import { SubstrateNetwork } from '../../../../SubstrateNetwork'

export class MetadataEvent extends SCALEClass {

    public static decode(network: SubstrateNetwork, raw: string): SCALEDecodeResult<MetadataEvent> {
        const decoder = new SCALEDecoder(network, raw)

        const name = decoder.decodeNextString()
        const args = decoder.decodeNextArray((_, hex) => SCALEString.decode(hex))
        const docs = decoder.decodeNextArray((_, hex) => SCALEString.decode(hex))

        return {
            bytesDecoded: name.bytesDecoded + args.bytesDecoded + docs.bytesDecoded,
            decoded: new MetadataEvent(name.decoded, args.decoded, docs.decoded)
        }
    }

    scaleFields = [this.name, this.args, this.docs]

    private constructor(
        readonly name: SCALEString,
        readonly args: SCALEArray<SCALEString>,
        readonly docs: SCALEArray<SCALEString>
    ) { super() }
}