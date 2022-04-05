import * as React from "react";
import styled from "styled-components";
import { Input } from "antd";
import "antd/dist/antd.css";

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

import contracts from "./constants/contracts";
import { getContract } from "./helpers/ethers";

import APT_ROUTER from "./constants/abis/AppleRouter.json";
import LMT_ROUTER from "./constants/abis/LimeRouter.json";
import APT_TOKEN from "./constants/abis/APT.json";
import LMT_TOKEN from "./constants/abis/LMT.json";

// import Button from "./components/Button";
import { formatEther, parseEther } from "ethers/lib/utils";
import { Contract } from "ethers/lib/ethers";

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
  appleChain: IChainConn;
  limeChain: IChainConn;
  limeToApple: {
    toBeExecuted: boolean;
    executed: boolean;
  };
  appleToLime: {
    toBeExecuted: boolean;
    executed: boolean;
  };
  result: any | null;
  info: any | null;
  error: any;
}

const INITIAL_STATE: IAppState = {
  fetching: false,
  pendingRequest: false,
  appleChain: {
    web3Modal: new Web3Modal(undefined),
    provider: null,
    library: null,
    chainId: -1,
    address: "",
    routerContract: new Contract(
      contracts.testnet.APT_ROUTER.address,
      APT_ROUTER.abi
    ),
    tokenContract: new Contract(
      contracts.testnet.APT_TOKEN.address,
      APT_TOKEN.abi
    ),
    connected: false
  },
  limeChain: {
    web3Modal: new Web3Modal(undefined),
    provider: null,
    library: null,
    chainId: -1,
    address: "",
    routerContract: new Contract(
      contracts.testnet.LMT_ROUTER.address,
      LMT_ROUTER.abi
    ),
    tokenContract: new Contract(
      contracts.testnet.LMT_TOKEN.address,
      LMT_TOKEN.abi
    ),
    connected: false
  },
  limeToApple: {
    toBeExecuted: true,
    executed: false,
  },
  appleToLime: {
    toBeExecuted: false,
    executed: false,
  },
  result: null,
  info: null,
  error: null,
};

class App extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    this.state = {
      ...INITIAL_STATE,
    };
  }

  public componentDidMount() {
    if (this.state.appleChain?.web3Modal.cachedProvider) {
      this.onConnectToLime();
      this.onConnectToApple();
    }
    if (this.state.limeChain?.web3Modal.cachedProvider) {
      this.onConnectToLime();
      this.onConnectToApple();
    }
  }

  public onConnectToLime = async () => {
    await this.setState({
      ...this.state,
      limeChain: {
        ...this.state.limeChain,
        chainId: 4,
        web3Modal: new Web3Modal({
          network: this.getNetwork(4),
          cacheProvider: true,
          providerOptions: this.getProviderOptions(),
        }),
      },
    });

    this.state.limeChain.provider = await this.state.limeChain.web3Modal.connect();

    const library = new Web3Provider(this.state.limeChain.provider);

    const signerAddress = await library.getSigner().getAddress();

    const network = await library.getNetwork();

    const address = this.state.limeChain.provider?.selectedAddress
      ? this.state.limeChain.provider?.selectedAddress
      : this.state.limeChain.provider?.accounts[0];

    const LMTRouterContract = getContract(
      contracts.testnet.LMT_ROUTER.address,
      LMT_ROUTER.abi,
      library,
      address
    );

    const LMTTokenContract = getContract(
      contracts.testnet.LMT_TOKEN.address,
      LMT_TOKEN.abi,
      library,
      address
    );

    await this.setState({
      ...this.state,
      limeChain: {
        ...this.state.limeChain,
        library,
        chainId: network.chainId,
        address: signerAddress,
        routerContract: LMTRouterContract,
        tokenContract: LMTTokenContract,
        connected: true
      },
    });

    LMTRouterContract.on(
      "LMTTokenLocked",
      async (sender, amount, receivingWalletAddress) => {
        await this.setState({
          limeToApple: {
            executed: true,
            toBeExecuted: false,
          },
        });
        const releaseTx = await this.state.appleChain.routerContract.releaseAmount(
          amount,
          receivingWalletAddress
        );
        await releaseTx.wait();
      }
    );

    LMTRouterContract.on("LMTTokenReleased", async (amount) => {
      await this.setState({
        appleToLime: {
          executed: true,
          toBeExecuted: false,
        },
      });
    });

    await this.subscribeToProviderEvents(this.state.limeChain);
  };

  public onConnectToApple = async () => {
    await this.setState({
      ...this.state,
      appleChain: {
        ...this.state.appleChain,
        chainId: 3,
        web3Modal: new Web3Modal({
          network: this.getNetwork(3),
          cacheProvider: true,
          providerOptions: this.getProviderOptions(),
        }),
      },
    });

    this.state.appleChain.provider = await this.state.appleChain.web3Modal.connect();

    const library = new Web3Provider(this.state.appleChain.provider);

    const signerAddress = await library.getSigner().getAddress();

    const network = await library.getNetwork();

    const address = this.state.appleChain.provider.selectedAddress
      ? this.state.appleChain.provider.selectedAddress
      : this.state.appleChain.provider?.accounts[0];

    const APTRouterContract = getContract(
      contracts.testnet.APT_ROUTER.address,
      APT_ROUTER.abi,
      library,
      address
    );

    const APTTokenContract = getContract(
      contracts.testnet.APT_TOKEN.address,
      APT_TOKEN.abi,
      library,
      address
    );

    this.setState({
      ...this.state,
      appleChain: {
        ...this.state.appleChain,
        library,
        chainId: network.chainId,
        address: signerAddress,
        routerContract: APTRouterContract,
        tokenContract: APTTokenContract,
        connected: true
      },
    });

    APTRouterContract.on(
      "APTTokenLocked",
      async (sender, amount, receivingWalletAddress) => {
        const releaseTx = await this.state.limeChain.routerContract.releaseAmount(
          amount,
          receivingWalletAddress
        );
        await releaseTx.wait();
        await this.setState({
          appleToLime: {
            executed: true,
            toBeExecuted: false,
          },
        });
      }
    );

    APTRouterContract.on("APTTokenReleased", async (amount) => {
      await this.setState({
        limeToApple: {
          executed: true,
          toBeExecuted: false,
        },
      });
    });

    await this.subscribeToProviderEvents(this.state.appleChain);
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

  public async bridgeAmount(from: string, amount: string) {
    await this.setState({ fetching: true });
    switch (from) {
      case "LMT":
        const lockLMTTx = await this.state.limeChain.routerContract.lockAmount(
          this.state.appleChain.address,
          parseEther(amount)
        );
        await lockLMTTx.wait();
        await this.setState({ fetching: false });
        break;
      case "APT":
        const lockAPTTx = await this.state.limeChain.routerContract.lockAmount(
          this.state.limeChain.address,
          parseEther(amount)
        );
        await lockAPTTx.wait();
        await this.setState({ fetching: false });
        break;

      default: {
        await this.setState({ fetching: false });
        return true;
      }
    }
    return false;
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
            connected={this.state.limeChain.connected}
            chainConnData={this.state.limeChain}
            killSession={(limeChain) => this.resetApp(limeChain)}
          />
          <Header
            connected={this.state.appleChain.connected}
            chainConnData={this.state.appleChain}
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
                {!this.state.limeChain.connected ? (
                  <>
                    <ConnectButton
                      title="Connect to Rinkeby Account (LMT) "
                      onClick={this.onConnectToLime}
                    />
                  </>
                ) : (
                  <></>
                )}
                {!this.state.appleChain.connected ? (
                  <ConnectButton
                    title="Connect to Ropsten Account (APT)"
                    onClick={this.onConnectToApple}
                  />
                ) : (
                  <></>
                )}
                {this.state.limeChain.connected &&
                this.state.appleChain.connected ? (
                  <>
                    <Input
                      disabled={!this.state.limeToApple.toBeExecuted}
                      name="lime-field"
                      placeholder="LMT Amount"
                    />
                    <Input
                      disabled={!this.state.appleToLime.toBeExecuted}
                      name="apple-field"
                      placeholder="APT Amount"
                    />
                    <ConnectButton
                      title="Swap"
                      onClick={async () => {
                        await this.setState({
                          error: this.state.appleToLime.toBeExecuted
                            ? await this.bridgeAmount("APT", "100")
                            : this.state.limeToApple.toBeExecuted
                            ? await this.bridgeAmount("LMT", "100")
                            : true,
                        });

                        const balanceLime = formatEther(
                          await this.state.limeChain.tokenContract.balanceOf(
                            this.state.limeChain.address
                          )
                        );
                        console.log(balanceLime);
                      }}
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
