import { ProtocolHTTPStub, TestProtocolSpec } from "../implementations";
import * as sinon from 'sinon'
import { KusamaProtocol } from "../../../src/protocols/substrate/implementations/KusamaProtocol";
import BigNumber from "../../../src/dependencies/src/bignumber.js-9.0.0/bignumber";
import { SubstrateTransactionType } from '../../../src/protocols/substrate/helpers/data/transaction/SubstrateTransaction'

export class KusamaProtocolStub implements ProtocolHTTPStub {

    public registerStub(testProtocolSpec: TestProtocolSpec, protocol: KusamaProtocol): void {
        sinon
            .stub(protocol.accountController, 'getBalance')
            .withArgs(sinon.match.any)
            .returns(Promise.resolve(new BigNumber(10000000000000)))
        
        sinon
            .stub(protocol.accountController, 'getTransferableBalance')
            .withArgs(sinon.match.any)
            .returns(Promise.resolve(new BigNumber(10000000000000)))

        this.registerDefaultStub(testProtocolSpec, protocol)
    }    
    
    public noBalanceStub(testProtocolSpec: TestProtocolSpec, protocol: KusamaProtocol): void {
        sinon
            .stub(protocol.accountController, 'getTransferableBalance')
            .withArgs(sinon.match.any)
            .returns(Promise.resolve(new BigNumber(0)))

        this.registerDefaultStub(testProtocolSpec, protocol)
    }

    private registerDefaultStub(testProtocolSpec: TestProtocolSpec, protocol: KusamaProtocol): void {
        sinon
            .stub(protocol, 'standardDerivationPath')
            .value('m/')

        sinon
            .stub(protocol.nodeClient, 'getTransactionMetadata')
            .withArgs(SubstrateTransactionType.TRANSFER)
            .returns(Promise.resolve({ moduleIndex: 4, callIndex: 0 }))
            .withArgs(SubstrateTransactionType.BOND)
            .returns(Promise.resolve({ moduleIndex: 6, callIndex: 0 }))
            .withArgs(SubstrateTransactionType.UNBOND)
            .returns(Promise.resolve({ moduleIndex: 6, callIndex: 2 }))
            .withArgs(SubstrateTransactionType.NOMINATE)
            .returns(Promise.resolve({ moduleIndex: 6, callIndex: 5 }))
            .withArgs(SubstrateTransactionType.CANCEL_NOMINATION)
            .returns(Promise.resolve({ moduleIndex: 6, callIndex: 6 }))

        sinon
            .stub(protocol.nodeClient, 'getTransferFeeEstimate')
            .returns(Promise.resolve(new BigNumber(testProtocolSpec.txs[0].fee)))

        sinon
            .stub(protocol.nodeClient, 'getAccountInfo')
            .withArgs(sinon.match.any)
            .returns(Promise.resolve({
                nonce: { value: new BigNumber(1) },
                data: {
                    free: { value: new BigNumber(1000000000000) },
                    reserved: { value: new BigNumber(0) },
                    miscFrozen: { value: new BigNumber(0) },
                    feeFrozen: { value: new BigNumber(0) }
                }
            }))

        sinon
            .stub(protocol.nodeClient, 'getFirstBlockHash')
            .returns(Promise.resolve('0xd51522c9ef7ba4e0990f7a4527de79afcac992ab97abbbc36722f8a27189b170'))

        sinon
            .stub(protocol.nodeClient, 'getLastBlockHash')
            .returns(Promise.resolve('0x33a7a745849347ce3008c07268be63d8cefd3ef61de0c7318e88a577fb7d26a9'))

        sinon
            .stub(protocol.nodeClient, 'getCurrentHeight')
            .returns(Promise.resolve(new BigNumber(3192)))

        sinon
            .stub(protocol.nodeClient, 'getSpecVersion')
            .returns(Promise.resolve(4))
    }

}