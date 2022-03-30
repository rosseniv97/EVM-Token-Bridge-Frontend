import * as React from "react";
import styled from "styled-components";

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
import { getContract, getSigner } from "./helpers/ethers";

import APT_ROUTER from "./constants/abis/AppleRouter.json";
import LMT_ROUTER from "./constants/abis/LimeRouter.json";

import Button from "./components/Button";
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
  limeChain: {
    library: any;
    chainId: number;
    address: string;
    connected: boolean;
    routerContract: Contract;
  };
  appleChain: {
    library: any;
    chainId: number;
    address: string;
    connected: boolean;
    routerContract: Contract;
  };
  pendingRequest: boolean;
  limeToApple: {
    started: boolean;
    finished: boolean;
    receivingWalletAddress: string;
    senderAddress: string;
    amount: number;
  };
  appleToLime: {
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
  limeChain: {
    library: null,
    chainId: 1,
    address: "",
    connected: true,
    routerContract: new Contract(LMT_ROUTER_ADDRESS, LMT_ROUTER.abi),
  },
  appleChain: {
    library: null,
    chainId: 1,
    address: "",
    connected: true,
    routerContract: new Contract(APT_ROUTER_ADDRESS, APT_ROUTER.abi),
  },
  pendingRequest: false,
  limeToApple: {
    started: false,
    finished: false,
    receivingWalletAddress: '',
    senderAddress: '',
    amount: 0,
  },
  appleToLime: {
    started: false,
    finished: false,
    receivingWalletAddress: '',
    senderAddress: '',
    amount: 0,
  },
  result: null,
  info: null,
  error: null,
};

class App extends React.Component<any, any> {
  // @ts-ignore
  public web3Modal: Web3Modal;
  public state: IAppState;
  public provider: any;

  constructor(props: any) {
    super(props);
    this.state = {
      ...INITIAL_STATE,
    };

    this.web3Modal = new Web3Modal({
      network: this.getNetwork(),
      cacheProvider: true,
      providerOptions: this.getProviderOptions(),
    });
  }

  public componentDidMount() {
    if (this.web3Modal.cachedProvider) {
      this.onConnectToLime();
      this.onConnectToApple();
    }
  }

  public onConnectToLime = async () => {
    this.provider = await this.web3Modal.connect();

    const library = new Web3Provider(this.provider);

    const network = await library.getNetwork();

    const address = this.provider.selectedAddress
      ? this.provider.selectedAddress
      : this.provider?.accounts[0];

    const LMTRouterContract = getContract(
      LMT_ROUTER_ADDRESS,
      LMT_ROUTER.abi,
      library,
      address
    );

    await this.setState({
      limeChain: {
        library,
        chainId: network.chainId,
        address,
        connected: true,
        LMTRouterContract,
      },
    });

    LMTRouterContract.on(
      "LMTTokenLocked",
      async (sender, amount, receivingWalletAddress) => {
        const releaseTx = await this.state.appleChain.routerContract.releaseAmount(
          amount
        );
        const receipt = await releaseTx.wait();
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

    LMTRouterContract.on(
      "LMTTokenReleased",
      async (amount) => {
        await this.setState({
          appleToLime: {
            started: false,
            finished: true,
            amount,
          },
        });
      }
    );

    await this.subscribeToProviderEvents(this.provider);
  };

  public onConnectToApple = async () => {
    this.provider = await this.web3Modal.connect();

    const library = new Web3Provider(this.provider);

    const network = await library.getNetwork();

    const address = this.provider.selectedAddress
      ? this.provider.selectedAddress
      : this.provider?.accounts[0];

    const APTRouterContract = getContract(
      APT_ROUTER_ADDRESS,
      APT_ROUTER.abi,
      library,
      address
    );

    await this.setState({
      appleChain: {
        library,
        chainId: network.chainId,
        address,
        connected: true,
        APTRouterContract,
      },
    });

    APTRouterContract.on(
      "APTTokenLocked",
      async (sender, amount, receivingWalletAddress) => {
        const releaseTx = await this.state.limeChain.routerContract.releaseAmount(
          amount
        );
        const receipt = await releaseTx.wait();
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

    await this.subscribeToProviderEvents(this.provider);
  };

  public subscribeToProviderEvents = async (provider: any) => {
    if (!provider.on) {
      return;
    }

    provider.on("accountsChanged", this.changedAccount);
    provider.on("networkChanged", this.networkChanged);
    provider.on("close", this.close);

    await this.web3Modal.off("accountsChanged");
  };

  public async unSubscribe(provider: any) {
    // Workaround for metamask widget > 9.0.3 (provider.off is undefined);
    window.location.reload(false);
    if (!provider.off) {
      return;
    }

    provider.off("accountsChanged", this.changedAccount);
    provider.off("networkChanged", this.networkChanged);
    provider.off("close", this.close);
  }

  public changedAccount = async (accounts: string[]) => {
    if (!accounts.length) {
      // Metamask Lock fire an empty accounts array
      await this.resetApp();
    } else {
      await this.setState({ address: accounts[0] });
    }
  };

  public networkChanged = async (networkId: number) => {
    const library = new Web3Provider(this.provider);
    const network = await library.getNetwork();
    const chainId = network.chainId;
    await this.setState({ chainId, library });
  };

  public close = async () => {
    this.resetApp();
  };

  public getNetwork = () => getChainData(this.state.chainId).network;

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

  public resetApp = async () => {
    await this.web3Modal.clearCachedProvider();
    localStorage.removeItem("WEB3_CONNECT_CACHED_PROVIDER");
    localStorage.removeItem("walletconnect");
    await this.unSubscribe(this.provider);

    this.setState({ ...INITIAL_STATE });
  };

  public render = () => {
    const { fetching } = this.state;
    return (
      <SLayout>
        <Column maxWidth={1000} spanHeight>
          <Header
            connected={connected}
            address={address}
            chainId={chainId}
            killSession={this.resetApp}
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
                {!this.state.limeChain.connected || !this.state.appleChain.connected ? (
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
                  <>
                    
                  </>
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
