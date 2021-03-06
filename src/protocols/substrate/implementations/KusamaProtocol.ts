import { SubstrateProtocol } from '../SubstrateProtocol'
import { SubstrateNetwork } from '../SubstrateNetwork'
import { FeeDefaults, CurrencyUnit } from '../../ICoinProtocol'
import { SubstrateNodeClient } from '../helpers/node/SubstrateNodeClient'
import { SubstrateBlockExplorerClient } from '../helpers/blockexplorer/SubstrateBlockExplorerClient'

const NODE_URL = 'https://polkadot-kusama-node-1.kubernetes.papers.tech'

const BLOCK_EXPLORER_URL = 'https://polkascan.io/pre/kusama'
const BLOCK_EXPLORER_API = 'https://api-01.polkascan.io/kusama/api/v1'

export class KusamaProtocol extends SubstrateProtocol {
    public symbol: string = 'KSM'
    public name: string = 'Kusama'
    public marketSymbol: string = 'KSM'
    public feeSymbol: string = 'KSM'

    public decimals: number = 12;
    public feeDecimals: number = 12;
    public identifier: string = 'kusama';

    public feeDefaults: FeeDefaults = {
        low: '0.01', // 10 000 000 000
        medium: '0.01',
        high: '0.01'
    }

    public units: CurrencyUnit[] = [
        {
            unitSymbol: 'KSM',
            factor: '1'
        },
        {
            unitSymbol: 'mKSM',
            factor: '0.001'
        },
        {
            unitSymbol: 'uKSM',
            factor: '0.000001'
        },
        {
            unitSymbol: 'Point',
            factor: '0.000000001'
        },
        {
            unitSymbol: 'Planck',
            factor: '0.000000000001'
        }
    ]

    public standardDerivationPath: string = `m/44'/434'/0'/0/0` // TODO: verify

    public constructor(
        network: SubstrateNetwork = SubstrateNetwork.KUSAMA,
        nodeClient: SubstrateNodeClient = new SubstrateNodeClient(network, NODE_URL),
        blockExplorerClient: SubstrateBlockExplorerClient = new SubstrateBlockExplorerClient(
            network,
            BLOCK_EXPLORER_URL, 
            BLOCK_EXPLORER_API
        ),
    ) { super(network, nodeClient, blockExplorerClient) }
}