import { TezosProtocol } from '../src'
import { TezosNetwork } from '../src/protocols/tezos/TezosProtocol'

const tezosProtocol: TezosProtocol = new TezosProtocol(
  'https://tezos-mainnet-node-1.kubernetes.papers.tech',
  'https://tezos-mainnet-conseil-1.kubernetes.papers.tech',
  TezosNetwork.MAINNET
)
// tz1MJx9vhaNRSimcuXPK2rW4fLccQnDAnVKJ: AirGap
// tz1eEnQhbwf6trb8Q8mPb2RaPkNk2rN7BKi8
tezosProtocol
  .calculateRewards('tz1MJx9vhaNRSimcuXPK2rW4fLccQnDAnVKJ', 167)
  .then(result => {
    console.log('REWARDS', result)
    tezosProtocol.calculatePayouts(result, 0, 200).then(result => {
      console.log('PAYOUTS', result)
    })
    tezosProtocol.calculatePayout('tz1MJx9vhaNRSimcuXPK2rW4fLccQnDAnVKJ', result).then(result => {
      console.log('PAYOUT', result)
    })
  })
  .catch(error => {
    console.log(error)
  })
