import * as sinon from 'sinon'

import { BitcoinProtocol } from '../../../src'
import axios from '../../../src/dependencies/src/axios-0.19.0/index'
import { ProtocolHTTPStub, TestProtocolSpec } from '../implementations'

export class BitcoinProtocolStub implements ProtocolHTTPStub {
  public registerStub(testProtocolSpec: TestProtocolSpec, protocol: BitcoinProtocol) {
    const stub = sinon.stub(axios, 'get')
    stub
      .withArgs(
        `https://insight.bitpay.com/api/addrs/1Kw98timgRcvsQcguq8Ko4A7hA7VD3iKBh,1DDNWqiRzQyz9Ljf8iF3rmVKn37XyN8kvk,1QKqr9wjki9K9tF9NxigbwgHeLXHT682sc,1KVA7HX16cef46Lpsi67v8ZV4y6bAiTmLt,1PEct6xfvsBZVyaLstYRwDKf7yi1daYV65,1DVyLqo5XoxrEnpT2e7mjHnatF5gBT2CKA,16C9w4Vur9QScKdgHFK4oB7gi4HSXg1rcd,1G1zqjJRBQpMx2rQhX9uuWDwfyVuNs8JTU,16eCikxG9yiB1ruh2N9eteSe51wfrksiuK,13Y7ukmtAQYVn9Z9xqVP7NQ6Jjfsi33t8H,1DKgnZ7Jk5htcsJGSXByA8KAM7d6356Vyk,12rr6Je8QyqUCsnWk9aSRi89Zb6zaZbyBr,1FDe3j4x2eXJU8FnzQmfTSMdfZKchekEDp,1C7RgZKJsCD2NAvoWdk9v1ARC61yE9NLab,1JFiwXrCaa6CejqtMqBpfoK4KwKRE6owMs,12Y6Pw8e3RVeZq3AiubVrtWyLVEAaYqhMV,1BBDySkMnmuqZruWXxsZESqAuUnxH2kr5g,17bYbqUw6ozWgy6AFzwjJ4FHKqG65rkMUv,18AjUXBj93iTmboVwMXTzje5VaMiEipcDs,1FGYSezqX4ksELCM519kudahrB3vw8DZhs,15NoAWgMmhFsarjpCHNDBQRyArTqgCSJBn,12pVrhxALencnXkJrSKicvUAKf2S2QQeHP,13fBx4ehi9e9qFqyQ9MC5TL3gXqdxdyuK7,17BumriZfwJ9emk9R4FtHob7TYauc2MUvn,1EgRdg4yEthSUmKxB8XeCARemVCATcUXKx,12gKTbRtnBDpfm6T9DuwSSU2WaY6on6Mhr,1JtQSPEDTp9Quuk2Uq4XypY6ruPqRKYj5a,1CMHfyA76sZ2k8rWxBnMiaLhma3VTncf6J,13x1xNFjzHvxKhJVPo81eQMecwF49UBWep,1EPGA3Q42zaDFcqAEHLcnFnPKMTwJMYQqE,1984jnyg4vJLRX46oa1UdzsfXtiW8HAvkw,1FDFaPbsfRyNHQLEwYzaSEf9fFVFjNjibk,13ogMg1uJKWXNx2TPPuF6spSgezFy2sVGm,1FiaTKPXvwkT6Q5jLjW5QsBVUW8fxDszGE,1DoYXLzefHfrA4vncbm7F8skmsxzzAykqx,1AUBtbnX9on1jd4i4zbYyVCALovtvGut7c,1NcqEBeure5dGMmanMi4CRhcAhFx5k8pTg,15ABwykiR9y6DXWwF9Bx9AmAdHUMboRsft,1HEJQtnd2tWktjBgEqVYgPgWTViGshDRxH,1E61GP2iSVPmmz3KsiEYyKe7e9W1HygFZu,1Eh5vojCCqT5ZgGwjnqdC462bnZLMt4Gdy,1Hkk6D13xT7amtp2sd1DxhRHv8MQq596vf,1BBD1w1FKjUiTsYWfffiyxUgCziR87phtW,1GyrvPQ5UEUeNNddm5RSHXzfdZTx2a3imH,1PkDzEDjAK3CmfS91M8x9wkfRMEYE9q1Aa,1E9LaCBvoisdchGa9UhAFS8J3EbTwUQiW2,13LEBb2Mr3TZEfcsTsVHuatrzEBiPwKmM7,1JbMnGYG9h6HikBxWmGBzDZeHidAu3HE2N,13CqaQJDd57HmtAgnDeTKcSQPr83LwoDMw,13hpiGgqfFTHU9GUX6oa6c3Ar3YQcm6PQ1,1586fqSDTQTqMHeTYCN6Af66wSkKqMrJ7e,1FX1RqfpL2uLqFja3LjHHYmJTmhkf7vi9a,19DafSz64qdpcWQVbhucGchmfsCMzyZ3Uo,1B254kybvKx6sHXh9mvPwJskD9f9jQEECN,1LcnUnFDV2CvnKSRkxBMhYfnZxRotmqKWG,14tt8LiqB3kiRW7eYKML1qNSUun8vKJVDv,1CTn5JkLJniqs4ckczq2ec62CDq2D9JtHA,1SkwSLviLGZbQfNHpAhmref7rToCkRyy8,1KPWPgvM17uQ5jZwBYdKXMRWEJhfmUopi1,15DT29CYRkpXEkKr9b2zxf5WzkH9ct5GF7,1HyXiUSc2R5TBiyFtRnVdcMdb8qJkfBAm,1CL9j7HjFpouLy1x68J2fJiVAQDPDsMZd9,1LshkVcgyb6zsu3KHqhyPgTYRKMZnU4z9p,15ZK1jbNNUyctiUtcBZbEw6eWd21rDsGPA,1SDD9rTDcwX3Hdh9XmEZbKWyQpFURsPJC,14GmKTNgAm3BDJwWo89qScoXCLUoiQQHYd,18Y7vuvhmpLW6MkH965tkzSmKaybX9uTd8,1EmDsYWW7vDBtjCBAWkRbx7jGFaGw7DEGm,12F2nbqT6iJpNKbn9roVngsWgon47YbHtr,1A93hVfJ1KXHGjiiEWuDHnuQSZPGmGoRFL,1GmcGnmwxC5JghsjVaudyP8m4kM8EWPhG7,1CyTJqC8JE6zVYL3fHgTb5dVeUGKJ4eFq7,1DR1eyWWWGQZhfAcsq5s6o8WcYKYXNAK56,1LQh4RxHJNdJ83THLkzsqpBeMvRN4Q7vwo,1M4DH9nnauCQfqm1BDYCxEJyUPkcvQBoGf,1Q4Z4kxnrx8LwkfG1nvTPAsv2ddbJDpBgA,1NXRQbf8bf4CKy7Y9nLGXbYyndGHWjiB6R,1HFxvZuAgwb7VUBfuTyRfd9q2HszZ4QH9D,1DUbx8rdM5grvgiur8JTqkRBwiAHXNXa1E,1222pj7cUFm6onMaQxYWVjU5SvRcFFJJwe,16HwbXJtaC13kqaLJJWY5xsGRDKquWqxYg,16gccGMcxAzacaP9ThqFmsJLysCAXvGMqe,1FRTVWmXni7P9YwH3kEeGgA95sWpnXojCk,1LzSHFftuk4vnkojP5w9Pu36tbFDUihifZ,1Dg5FARKpHpHAS3imD1d5ehqDwf72kvEVi,1BaKiiSC2RL1ptZJxVVbYV7JtHweJJQ4Mv,12FPYv9MXr9Xpcdd9q9GLjpRtabX9nvtTt,1BnQsNwxKku9mC9t5A6ecqVNy9mzTz4TAn,1GZ5Dg6KkwgtbgdXJUzGMGvdAQJ3NxnBqP,1Afs9UPXkDXP94ih1QUwQt8Q621xhoEFZ2,1KUSfgHbtPky9pegqeHfKvb44iy49WgXVM,1CiMULamkmUESfeCYNEQv75ApxbrRLM6Ng,17GVBgFTvjVYiachGvNXq8WDEUerRuixRF,1ACneQdj5ZJqEKqi3yvtKzrmJKry6wmUC7,1E8pLSTvCSsXSYMxKZ3KEQY3mMqgNDFT9s,1CpXc3QHdRtquEHU7H1koPp7XW6MvLX1fi,1EinrdXN1vYonhKJzSEpofChfn9igRTSc5,15NZt36PuYJhKc1Esjh3FZrDxNrHTG6gNX,1LDHjZFRT5CaYhmK4p3z4Rj7G1Z9b6g66n,1FxyLeAJircqdrhzfURjhbjEy8DF3f87qx,15B2gX2x1eqFKgR44nCe1i33ursGKP4Qpi,15srTWTrucPWSUGFZY2LWaYobwpDLknz49,1HWKjSRKVr1TGKjvkkf1zYtCpQoUgkyoZB,1B9JPvqXQfpVtRH7PaGykczyRRd9y97zRy,173BsZBzeuu7VrZMqnSy5XngKH5Ngsj9kV,1CHBs1yFdh5UdRPF9qndGY9UJpDXeDfFDh,1D9u1uU13dZw5eMGRgH1ECdSRpN2yBunSq,1NVCaFFgfom8Po5Bcer4emRri8tWvWBmSb,18uFHWBDXqD28nKvBCpJDTqE8q4aA4Rjmm,17pANHNCVpszdnmhQnPSMMnuTAfWPJLjJK,1KsK34STpRMoYRSZBHK2L4HxiaMpHQpMY1,16ozp6kyzmXbiGq8ngBH8m8LHEvauUxr3A,1d46WfqATpUTqBdJzzCAWyuhqcBFefCXq,1NhByb2VV6sXGqkinXjPU7pjvrAYJYASaa,19NpGuMK4WAB8fxC3aJd4dTu4TeeHDbFWV,1MgjnSd56y211qXL3swEsia7PhjDn8ETcW,12MBp3cJqxrLk81dwdBd6okf9G5MQBcsT9,19WSob7FyVcMCJKGwP2Gz9kNoFPZpVqRpC,1Dxjbtvior7ACRLrvhJ6bcz15undnpNnYf,15Z8fSW47AhwQ6w5Hg41WJX6zYcsiWNuAS,1GNUNgS4QUh9EKLWz3iMeoSQHyAUumCU5o,19G35gFr7X7UzHicA8cDrfx2rzBst4JmgH,15SBy1cU1CQTYRGaFfp4EMeeHMCZmJnPhe,14qKXNMZvbPc2xJKLScZEARF6KADiGteTF,1Cky5GShwJv25eT4bnwc8J3mVAQEqanT12,125xhx6jGHT1LQWbxeg1V93Pv7KwoEcGRs,1JQVBRyHumN41adzRN1THG7mkPVrq9Y7ij,1QKK6BsoEqN4aqfiaaT6dpreaARdp3qSBJ,16QfR5UZJiFC7PnKcz9vC3TWN6BDxmcx1A,137DxhxTXAKsXDDdD1UkqpexfUT69ZgySJ,1DrNPPbRrdCfcTQRoraaSFCVNBaizkVdZX,1JAigCtunH9VC3xXHg1rJGDPmq56tyrrGP,1MBTSRjCEi6BtZEnDiU9EkDq6jghW52VxD,1NaEc5XjXGpMtZVrpHevoWWJwFbd4Uzxiy,1LdHnduhzpHnrP7b6ti2mCy6wwumWfoFjs,1CMMFibEg81p6UVVG1WFQMGQC7QxebxqNJ,1GRbk8bLBEbwrBEaMfRubrU2TVohRQWdKd,1KzLP7bbxtCY4f1yJYarMyujVyo1rBHxav,1LAKfBujje9doGf2UWGNadjCgB8CwsFPFm,18pT1UtHVMjqyTF5a7oE8Z2SUrYJf8BRgw,17pHjAtGuLdLNR3iDSEg7RmNcpY2StoVJ,1Ge27dY4W4SuCRCjGKHor2br5GNAixp8uQ,1HZKFRyrEYoahKjDdmn8EF3GrNQimqF7eU,1HHFsMLEWbkc8YWoHh8ek1dWSnyj4pSB7h,1LfuQ7aFaVwvtxjiTNM7swjpCj1eyXYeVq,1MPrA9LQ3Xu1YLbkGrKk49suL5bLJRCGTU,1Zpvkk83SZbQocxc16GUdWfcXbbASaFQF,1Md6runddnLdJwWqCmXue47Kmfdj4DQHJd,19FhBvKFzfFzhwh2F8HzEaeJsxDfwh6tNT,1KMxAX1JdxHq5intvhiL1vxct8cxoUb28d,1DGyWKyqesSQmQfikRNkipT5bQ4pyLknUr,12SyCMBEig2JFiDDd6G1dPYJsza48FJwB2,15GQamoTRfAh9me4XsqMsrKXPLKvjuxndj,1KNuDzncJTft1XTVxSHZaHQdheSx1i5g99,1F3Kejh1Kn8fpWSCYxUa4jrtWkETN699YA,1S1YvsmZu9zcHbsAS7VGgoLM3ns7RpFGh,1M5gSX7Wf94WyJ82sMgzC5wiTWggeUxUtd,1Jjr4tQvt71QJefzC22yR96VgvZe2jA9kM,1DA4kKV2p5X7gV238Ch8tsSHU2qAXYufte,1BwAFBNLS7dK1tC2wUD9ugxMTPMJHwFWcx,195wZYEZQp8pnxCq4WFwz4xipsBCH72944,1J6mTAdMLBgxaNWRuB1JmqgD2yoNTR6rpy,1AsFKpa5JY9d3CWhvxGkcSMadQatmXJpwV,19Mj27TTMn7g4NPVv6dZtCjxwfBH7tG6AH,15PtjVst4daQMk2fUL3cvfzr6X1MgURZgv,1HF1r2UfDDkMeo9FaAzTzfWzFmaGkUwZd5,1NfxudDzwzVKQPCfCCH6kDXe8qjmZwL4x6,17fyJFoiXhzAiybBAsKZ3WuQ2zTj5tZgUT,1M5CU37aTC3sCAp7ZdgqXqvNvrVNEyop9g,1FusV7osvDrsHgQ2cBEnQeKvisz7D2MGQz,18zRTsESAvRW9ptDoTwjgDMRRzG9cpKhWH,12wW7sgZPZxnXE1QPS8LtcQv7TkZ5sWEbD,1EXbog5FhtbwuBRLSnT9w63aPg6QYRceaP,1KuMYPrtc5hRP8HwW6p3SKzehWPEE1R8dE,1M4Jdm8SVBk3ALki9ffDEJ61VpajrLpj1G,1BQmhqWn9iTZGL3uTzgitVSKenzTW3qcrk,1MwknZa3PocfTNiKLSyXrvvo7urPKyYc7C,1AjgToA51cUtFt2yEdYnFwL4T69eTYM8kt,12QU91jQwJ48LJh3YdqJDfUmERFp8DyPnc,1P3EDZJyNE2SPqvs1twrVt3HVi55MAzsji,1HvFMGSP1uaH6YmJQbkr1KcG6jkHruCdAw,16aEDSTX88Kgi9fyz3X5YacmkGQtsczrrd,16QbQURobEpwCfWfD8HHvaWPJmudHH1Ycm,1KFLTDYaZgRf9Pzbbm9PEV2zMaDXesTfbe,1CGfGdNyGqJpM4CUP7AEekZWAfNCJY8mYh,1EJMqqeSLoU57qbgUBm57puSaVAKdVCeRJ,1PaWmmy8oHMtHjMF575Yarre7XQz1Ncs72,1BkxhCmvhdR3PbWGqcJN5qEZumKjZspqro,1ANHSnjaZPWDYMxFnXuFMXF4XErb7bkw1u,1NB95MxfPVaZ8ztNaPGrA3YHE1ML95XZPk,1AfTY9a9awY2FJPV2rQDc2CDa1sPYxyY77,18MCceGPYThmTihSQKT6dUfA5NNxkzh7HR,1Bos1fwCGXbf2UJdDVfBqRg8hwuiH62Vhs,1FrLy4RzyPwpShwksLfYQXuP64rBiVZSJ8,1NWqdW5qTYHezpEFiyZhXhfCf9eFeufhUh,1Q2BGFMJnPuzmhxHWJz9tth6euHwHmKjJw,1Eq9R7AeAy2MWS4utQXEu8iwYJJA425yXa,1Ni2wNRxPEibMFhWpdCBTNUSQU3R1hDDGX,1HUfotM2iSQLcTVZ3vUT2zooTgoyLsxebK,1NA6tHrvWSV6KfRtk8UmJoe9LDnTDwzLP1/utxo`
      )
      .returns(
        Promise.resolve({
          data: [
            {
              address: '15B2gX2x1eqFKgR44nCe1i33ursGKP4Qpi',
              txid: '8a10220812842e93b7263491cf664b36fece9861b39ca762b57ac46bb7a7cd7b',
              vout: 0,
              scriptPubKey: '76a9141b6d966bb9c605b984151da9bed896145698c44288ac',
              amount: 1e-7,
              satoshis: 10,
              height: 1353085,
              confirmations: 132951
            },
            {
              address: '1QKqr9wjki9K9tF9NxigbwgHeLXHT682sc',
              txid: 'cc69b832b6d922a04bf9653bbd12335a78f82fc09be7536f2378bbad8554039d',
              vout: 0,
              scriptPubKey: '76a9141b6d966bb9c605b984151da9bed896145698c44288ac',
              amount: 0.65,
              satoshis: 32418989,
              height: 1296906,
              confirmations: 189130
            }
          ]
        })
      )

    stub
      .withArgs(
        `https://insight.bitpay.com/api/addrs/1Kw98timgRcvsQcguq8Ko4A7hA7VD3iKBh,1DDNWqiRzQyz9Ljf8iF3rmVKn37XyN8kvk,1QKqr9wjki9K9tF9NxigbwgHeLXHT682sc,1KVA7HX16cef46Lpsi67v8ZV4y6bAiTmLt,1PEct6xfvsBZVyaLstYRwDKf7yi1daYV65,1DVyLqo5XoxrEnpT2e7mjHnatF5gBT2CKA,16C9w4Vur9QScKdgHFK4oB7gi4HSXg1rcd,1G1zqjJRBQpMx2rQhX9uuWDwfyVuNs8JTU,16eCikxG9yiB1ruh2N9eteSe51wfrksiuK,13Y7ukmtAQYVn9Z9xqVP7NQ6Jjfsi33t8H,1DKgnZ7Jk5htcsJGSXByA8KAM7d6356Vyk,12rr6Je8QyqUCsnWk9aSRi89Zb6zaZbyBr,1FDe3j4x2eXJU8FnzQmfTSMdfZKchekEDp,1C7RgZKJsCD2NAvoWdk9v1ARC61yE9NLab,1JFiwXrCaa6CejqtMqBpfoK4KwKRE6owMs,12Y6Pw8e3RVeZq3AiubVrtWyLVEAaYqhMV,1BBDySkMnmuqZruWXxsZESqAuUnxH2kr5g,17bYbqUw6ozWgy6AFzwjJ4FHKqG65rkMUv,18AjUXBj93iTmboVwMXTzje5VaMiEipcDs,1FGYSezqX4ksELCM519kudahrB3vw8DZhs,15NoAWgMmhFsarjpCHNDBQRyArTqgCSJBn,12pVrhxALencnXkJrSKicvUAKf2S2QQeHP,13fBx4ehi9e9qFqyQ9MC5TL3gXqdxdyuK7,17BumriZfwJ9emk9R4FtHob7TYauc2MUvn,1EgRdg4yEthSUmKxB8XeCARemVCATcUXKx,12gKTbRtnBDpfm6T9DuwSSU2WaY6on6Mhr,1JtQSPEDTp9Quuk2Uq4XypY6ruPqRKYj5a,1CMHfyA76sZ2k8rWxBnMiaLhma3VTncf6J,13x1xNFjzHvxKhJVPo81eQMecwF49UBWep,1EPGA3Q42zaDFcqAEHLcnFnPKMTwJMYQqE,1984jnyg4vJLRX46oa1UdzsfXtiW8HAvkw,1FDFaPbsfRyNHQLEwYzaSEf9fFVFjNjibk,13ogMg1uJKWXNx2TPPuF6spSgezFy2sVGm,1FiaTKPXvwkT6Q5jLjW5QsBVUW8fxDszGE,1DoYXLzefHfrA4vncbm7F8skmsxzzAykqx,1AUBtbnX9on1jd4i4zbYyVCALovtvGut7c,1NcqEBeure5dGMmanMi4CRhcAhFx5k8pTg,15ABwykiR9y6DXWwF9Bx9AmAdHUMboRsft,1HEJQtnd2tWktjBgEqVYgPgWTViGshDRxH,1E61GP2iSVPmmz3KsiEYyKe7e9W1HygFZu,1Eh5vojCCqT5ZgGwjnqdC462bnZLMt4Gdy,1Hkk6D13xT7amtp2sd1DxhRHv8MQq596vf,1BBD1w1FKjUiTsYWfffiyxUgCziR87phtW,1GyrvPQ5UEUeNNddm5RSHXzfdZTx2a3imH,1PkDzEDjAK3CmfS91M8x9wkfRMEYE9q1Aa,1E9LaCBvoisdchGa9UhAFS8J3EbTwUQiW2,13LEBb2Mr3TZEfcsTsVHuatrzEBiPwKmM7,1JbMnGYG9h6HikBxWmGBzDZeHidAu3HE2N,13CqaQJDd57HmtAgnDeTKcSQPr83LwoDMw,13hpiGgqfFTHU9GUX6oa6c3Ar3YQcm6PQ1,1586fqSDTQTqMHeTYCN6Af66wSkKqMrJ7e,1FX1RqfpL2uLqFja3LjHHYmJTmhkf7vi9a,19DafSz64qdpcWQVbhucGchmfsCMzyZ3Uo,1B254kybvKx6sHXh9mvPwJskD9f9jQEECN,1LcnUnFDV2CvnKSRkxBMhYfnZxRotmqKWG,14tt8LiqB3kiRW7eYKML1qNSUun8vKJVDv,1CTn5JkLJniqs4ckczq2ec62CDq2D9JtHA,1SkwSLviLGZbQfNHpAhmref7rToCkRyy8,1KPWPgvM17uQ5jZwBYdKXMRWEJhfmUopi1,15DT29CYRkpXEkKr9b2zxf5WzkH9ct5GF7,1HyXiUSc2R5TBiyFtRnVdcMdb8qJkfBAm,1CL9j7HjFpouLy1x68J2fJiVAQDPDsMZd9,1LshkVcgyb6zsu3KHqhyPgTYRKMZnU4z9p,15ZK1jbNNUyctiUtcBZbEw6eWd21rDsGPA,1SDD9rTDcwX3Hdh9XmEZbKWyQpFURsPJC,14GmKTNgAm3BDJwWo89qScoXCLUoiQQHYd,18Y7vuvhmpLW6MkH965tkzSmKaybX9uTd8,1EmDsYWW7vDBtjCBAWkRbx7jGFaGw7DEGm,12F2nbqT6iJpNKbn9roVngsWgon47YbHtr,1A93hVfJ1KXHGjiiEWuDHnuQSZPGmGoRFL,1GmcGnmwxC5JghsjVaudyP8m4kM8EWPhG7,1CyTJqC8JE6zVYL3fHgTb5dVeUGKJ4eFq7,1DR1eyWWWGQZhfAcsq5s6o8WcYKYXNAK56,1LQh4RxHJNdJ83THLkzsqpBeMvRN4Q7vwo,1M4DH9nnauCQfqm1BDYCxEJyUPkcvQBoGf,1Q4Z4kxnrx8LwkfG1nvTPAsv2ddbJDpBgA,1NXRQbf8bf4CKy7Y9nLGXbYyndGHWjiB6R,1HFxvZuAgwb7VUBfuTyRfd9q2HszZ4QH9D,1DUbx8rdM5grvgiur8JTqkRBwiAHXNXa1E,1222pj7cUFm6onMaQxYWVjU5SvRcFFJJwe,16HwbXJtaC13kqaLJJWY5xsGRDKquWqxYg,16gccGMcxAzacaP9ThqFmsJLysCAXvGMqe,1FRTVWmXni7P9YwH3kEeGgA95sWpnXojCk,1LzSHFftuk4vnkojP5w9Pu36tbFDUihifZ,1Dg5FARKpHpHAS3imD1d5ehqDwf72kvEVi,1BaKiiSC2RL1ptZJxVVbYV7JtHweJJQ4Mv,12FPYv9MXr9Xpcdd9q9GLjpRtabX9nvtTt,1BnQsNwxKku9mC9t5A6ecqVNy9mzTz4TAn,1GZ5Dg6KkwgtbgdXJUzGMGvdAQJ3NxnBqP,1Afs9UPXkDXP94ih1QUwQt8Q621xhoEFZ2,1KUSfgHbtPky9pegqeHfKvb44iy49WgXVM,1CiMULamkmUESfeCYNEQv75ApxbrRLM6Ng,17GVBgFTvjVYiachGvNXq8WDEUerRuixRF,1ACneQdj5ZJqEKqi3yvtKzrmJKry6wmUC7,1E8pLSTvCSsXSYMxKZ3KEQY3mMqgNDFT9s,1CpXc3QHdRtquEHU7H1koPp7XW6MvLX1fi,1EinrdXN1vYonhKJzSEpofChfn9igRTSc5,15NZt36PuYJhKc1Esjh3FZrDxNrHTG6gNX,1LDHjZFRT5CaYhmK4p3z4Rj7G1Z9b6g66n,1FxyLeAJircqdrhzfURjhbjEy8DF3f87qx,18MwerXaLVrTshUSJyg8ZZAq2LhJwia9QE/txs`
      )
      .returns(
        Promise.resolve({
          data: {
            items: [
              {
                vout: [
                  {
                    value: '0.00000010',
                    n: 0,
                    scriptPubKey: {
                      hex: '76a9141b6d966bb9c605b984151da9bed896145698c44288ac',
                      asm: 'OP_DUP OP_HASH160 1b6d966bb9c605b984151da9bed896145698c442 OP_EQUALVERIFY OP_CHECKSIG',
                      addresses: ['18MwerXaLVrTshUSJyg8ZZAq2LhJwia9QE'],
                      type: 'pubkeyhash'
                    },
                    spentTxId: '97255cd7b3ae211aff3a3f67d3fadb38cc1f3f28cd63dcf5fef6d166fbf56ac4',
                    spentIndex: 0,
                    spentHeight: 1346781
                  }
                ]
              }
            ]
          }
        })
      )
  }
  public noBalanceStub() {
    //
  }
}
