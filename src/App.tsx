import * as React from "react";
import styled from "styled-components";

import { IChainConn } from "./helpers/types";

import Web3Modal from "web3modal";
// @ts-ignore
import WalletConnectProvider from "@walletconnect/web3-provider";
import Column from "./components/Column";
import Wrapper from "./components/Wrapper";
import Header from "./components/Header";
import Loader from "./components/Loader";
import ConnectButton from "./components/ConnectButton";

import { Web3Provider } from "@ethersproject/providers";
import { getChainData } from "./helpers/utilities";

import { LMT_ROUTER_ADDRESS, APT_ROUTER_ADDRESS } from "./constants";
import { getContract } from "./helpers/ethers";

import APT_ROUTER from "./constants/abis/AppleRouter.json";
import LMT_ROUTER from "./constants/abis/LimeRouter.json";

// import Button from "./components/Button";
import { Contract } from "ethers";

const SLayout = styled.div`
  position: relative;
  width: 100%;
  min-height: 100vh;
  text-align: center;
`;

const SContent = styled(Wrapper)`
  width: 100%;
  height: 100%;
  padding: 0 16px;
`;

const SContainer = styled.div`
  height: 100%;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  word-break: break-word;
`;

const SLanding = styled(Column)`
  height: 600px;
`;

// @ts-ignore
const SBalances = styled(SLanding)`
  height: 100%;
  & h3 {
    padding-top: 30px;
  }
`;

interface IAppState {
  fetching: boolean;
  pendingRequest: boolean;
  limeToApple: {
    connected: boolean;
    started: boolean;
    finished: boolean;
    receivingWalletAddress: string;
    senderAddress: string;
    amount: number;
  };
  appleToLime: {
    connected: boolean;
    started: boolean;
    finished: boolean;
    receivingWalletAddress?: string;
    senderAddress?: string;
    amount: number;
  };
  result: any | null;
  info: any | null;
  error: any;
}

const INITIAL_STATE: IAppState = {
  fetching: false,
  pendingRequest: false,
  limeToApple: {
    connected: false,
    started: false,
    finished: false,
    receivingWalletAddress: "",
    senderAddress: "",
    amount: 0,
  },
  appleToLime: {
    connected: false,
    started: false,
    finished: false,
    receivingWalletAddress: "",
    senderAddress: "",
    amount: 0,
  },
  result: null,
  info: null,
  error: null,
};

class App extends React.Component<any, any> {
  public appleChain: IChainConn = {
    web3Modal: new Web3Modal(undefined),
    provider: null,
    library: null,
    chainId: 1,
    address: "",
    routerContract: new Contract(APT_ROUTER_ADDRESS, APT_ROUTER.abi),
  };
  public limeChain: IChainConn = {
    web3Modal: new Web3Modal(undefined),
    provider: null,
    library: null,
    chainId: 1,
    address: "",
    routerContract: new Contract(LMT_ROUTER_ADDRESS, LMT_ROUTER.abi),
  };

  constructor(props: any) {
    super(props);
    this.state = {
      ...INITIAL_STATE,
    };
  }

  public componentDidMount() {
    if (this.appleChain.web3Modal.cachedProvider) {
      this.onConnectToLime();
      this.onConnectToApple();
    }
    if (this.limeChain.web3Modal.cachedProvider) {
      this.onConnectToLime();
      this.onConnectToApple();
    }
  }

  public onConnectToLime = async () => {
    this.limeChain = {
      ...this.limeChain,
      web3Modal: new Web3Modal({
        network: this.getNetwork(3),
        cacheProvider: true,
        providerOptions: this.getProviderOptions(),
      }),
    };

    this.limeChain.provider = await this.limeChain.web3Modal.connect();

    const library = new Web3Provider(this.limeChain.provider);

    const network = await library.getNetwork();

    const address = this.limeChain.provider?.selectedAddress
      ? this.limeChain.provider?.selectedAddress
      : this.limeChain.provider?.accounts[0];

    const LMTRouterContract = getContract(
      LMT_ROUTER_ADDRESS,
      LMT_ROUTER.abi,
      library,
      address
    );

    (this.limeChain = {
      ...this.limeChain,
      library,
      chainId: network.chainId,
      address,
      routerContract: LMTRouterContract,
    }),

    await this.setState((prevState: IAppState) => {
      return {
        ...prevState,
        limeToApple: {
          ...prevState.limeToApple,
          connected: true
        }
      }
    })
      LMTRouterContract.on(
        "LMTTokenLocked",
        async (sender, amount, receivingWalletAddress) => {
          const releaseTx = await this.state.appleChain.routerContract.releaseAmount(
            amount
          );
          await releaseTx.wait();
          await this.setState({
            limeToApple: {
              started: true,
              finished: false,
              receivingWalletAddress,
              senderAddress: sender,
              amount,
            },
          });
        }
      );

    LMTRouterContract.on("LMTTokenReleased", async (amount) => {
      await this.setState({
        appleToLime: {
          started: false,
          finished: true,
          amount,
        },
      });
    });

    await this.subscribeToProviderEvents(this.limeChain);
  };

  public onConnectToApple = async () => {
    this.appleChain = {
      ...this.appleChain,
      web3Modal: new Web3Modal({
        network: this.getNetwork(3),
        cacheProvider: true,
        providerOptions: this.getProviderOptions(),
      }),
    };

    this.appleChain = {
      ...this.appleChain,
      provider: await this.appleChain.web3Modal.connect(),
    };

    const library = new Web3Provider(this.appleChain.provider);

    const network = await library.getNetwork();

    const address = this.appleChain.provider.selectedAddress
      ? this.appleChain.provider.selectedAddress
      : this.appleChain.provider?.accounts[0];

    const APTRouterContract = getContract(
      APT_ROUTER_ADDRESS,
      APT_ROUTER.abi,
      library,
      address
    );

    (this.appleChain = {
      ...this.appleChain,
      library,
      chainId: network.chainId,
      address,
      routerContract: APTRouterContract,
    })

    await this.setState((prevState: IAppState) => {
      return {
        ...prevState,
        appleToLime: {
          ...prevState.appleToLime,
          connected: true
        }
      }
    })
      APTRouterContract.on(
        "APTTokenLocked",
        async (sender, amount, receivingWalletAddress) => {
          const releaseTx = await this.state.limeChain.routerContract.releaseAmount(
            amount
          );
          await releaseTx.wait();
          await this.setState({
            appleToLime: {
              started: true,
              finished: false,
              receivingWalletAddress,
              senderAddress: sender,
              amount,
            },
          });
        }
      );

    APTRouterContract.on("APTTokenReleased", async (amount) => {
      await this.setState({
        appleToLime: {
          started: true,
          finished: false,
          amount,
        },
      });
    });

    await this.subscribeToProviderEvents(this.appleChain);
  };

  public subscribeToProviderEvents = async (chainData: IChainConn) => {
    if (!chainData.provider.on) {
      return;
    }

    chainData.provider.on(
      "accountsChanged",
      async (accounts: string[]) =>
        await this.changedAccount(accounts, chainData)
    );
    chainData.provider.on(
      "networkChanged",
      async () => await this.networkChanged(chainData)
    );
    chainData.provider.on("close", this.close);

    await chainData.web3Modal.off("accountsChanged");
  };

  public async unSubscribe(chainData: IChainConn) {
    // Workaround for metamask widget > 9.0.3 (provider.off is undefined);
    window.location.reload(false);
    if (!chainData.provider.off) {
      return;
    }

    chainData.provider.off(
      "accountsChanged",
      async (accounts: string[]) =>
        await this.changedAccount(accounts, chainData)
    );
    chainData.provider.off(
      "networkChanged",
      async () => await this.networkChanged(chainData)
    );
    chainData.provider.off("close", this.close);
  }

  public changedAccount = async (accounts: string[], chainData: IChainConn) => {
    if (!accounts.length) {
      // Metamask Lock fire an empty accounts array
      await this.resetApp(chainData);
    } else {
      await this.setState({ address: accounts[0] });
    }
  };

  public networkChanged = async (chainData: IChainConn) => {
    const library = new Web3Provider(chainData.provider);
    const network = await library.getNetwork();
    const chainId = network.chainId;
    chainData = {
      ...chainData,
      chainId,
      library,
    };
  };

  public close = async (chainData: IChainConn) => {
    this.resetApp(chainData);
  };

  public getNetwork = (chainId: number) => getChainData(chainId).network;

  public getProviderOptions = () => {
    const providerOptions = {
      walletconnect: {
        package: WalletConnectProvider,
        options: {
          infuraId: process.env.REACT_APP_INFURA_ID,
        },
      },
    };
    return providerOptions;
  };

  public resetApp = async (chainData: IChainConn) => {
    await chainData.web3Modal.clearCachedProvider();
    localStorage.removeItem("WEB3_CONNECT_CACHED_PROVIDER");
    localStorage.removeItem("walletconnect");
    await this.unSubscribe(chainData);

    this.setState({ ...INITIAL_STATE });
  };

  public render = () => {
    const { fetching } = this.state;
    return (
      <SLayout>
        <Column maxWidth={1000} spanHeight>
          <Header
            connected={this.state.limeToApple.connected}
            chainConnData={this.limeChain}
            killSession={(limeChain) => this.resetApp(limeChain)}
          />
          <Header
            connected={this.state.appleToLime.connected}
            chainConnData={this.appleChain}
            killSession={(appleChain) => this.resetApp(appleChain)}
          />
          <SContent>
            {fetching ? (
              <Column center>
                <SContainer>
                  <Loader />
                </SContainer>
              </Column>
            ) : (
              <SLanding center>
                {!this.state.limeToApple.connected || !this.state.appleToLime.connected ? (
                  <>
                    <ConnectButton
                      title="Connect to Lime Account"
                      onClick={this.onConnectToLime}
                    />
                    <ConnectButton
                      title="Connect to Apple Account"
                      onClick={this.onConnectToApple}
                    />
                  </>
                ) : (
                  <></>
                )}
                {this.state.error ? (
                  <div>ERROR submitting transacation</div>
                ) : (
                  <></>
                )}
              </SLanding>
            )}
          </SContent>
        </Column>
      </SLayout>
    );
  };
}

export default App;
