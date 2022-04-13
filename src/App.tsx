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

import ROUTER from "./constants/abis/Router.json";
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
  chainConnection: IChainConn;
  sourceToTarget: any;
  claimable: any;
  sourceInput: string;
  result: any | null;
  info: any | null;
  error: any;
}

const INITIAL_STATE: IAppState = {
  fetching: false,
  pendingRequest: false,
  chainConnection: {
    web3Modal: new Web3Modal(undefined),
    provider: null,
    library: null,
    chainId: -1,
    address: "",
    sourceRouterContract: new Contract(contracts.LMT_ROUTER.address, ROUTER.abi),
    sourceTokenContract: new Contract(contracts.LMT_TOKEN.address, ROUTER.abi),
    targetRouterContract: new Contract(contracts.APT_ROUTER.address, ROUTER.abi),
    connected: false,
  },
  sourceToTarget: {
    source: "lime",
    target: "apple",
  },
  claimable: {
    amount: 0,
    claimed: 0,
  },
  sourceInput: "",
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
      this.onConnect();
    }
  }

  public onConnect = async () => {
    await this.setState({fetching: true}) 
    await this.setState({
      chainConnection: {
        ...this.state.chainConnection,
        chainId: 4,
        web3Modal: new Web3Modal({
          network: this.getNetwork(4),
          cacheProvider: false,
          providerOptions: this.getProviderOptions(),
        }),
      },
    });

    const provider = await this.state.chainConnection.web3Modal.connect();

    const library = new Web3Provider(provider);

    const signerAddress = await library.getSigner().getAddress();

    const network = await library.getNetwork();

    const address = provider.selectedAddress
      ? provider?.selectedAddress
      : provider?.accounts[0];

    const sourceRouterAddress =
      this.state.sourceToTarget.source === "lime"
        ? contracts.LMT_ROUTER.address
        : this.state.sourceToTarget.source === "apple"
        ? contracts.APT_ROUTER.address
        : "";

    const targetRouterAddress =
      this.state.sourceToTarget.target === "lime"
        ? contracts.LMT_ROUTER.address
        : this.state.sourceToTarget.target === "apple"
        ? contracts.APT_ROUTER.address
        : "";

    const sourceTokenAddress =
      this.state.sourceToTarget.source === "lime"
        ? contracts.LMT_TOKEN.address
        : this.state.sourceToTarget.source === "apple"
        ? contracts.APT_TOKEN.address
        : "";

    const sourceTokenAbi =
      this.state.sourceToTarget.source === "lime"
        ? LMT_TOKEN.abi
        : this.state.sourceToTarget.source === "apple"
        ? APT_TOKEN.abi
        : "";

    const sourceRouterContract = getContract(
      sourceRouterAddress,
      ROUTER.abi,
      library,
      address
    );

    const targetRouterContract = getContract(
      targetRouterAddress,
      ROUTER.abi,
      library,
      address
    );

    const sourceTokenContract = getContract(
      sourceTokenAddress,
      sourceTokenAbi,
      library,
      address
    ); 
    const approveRouterTx = await sourceTokenContract.approve(
      sourceRouterContract.address,
      parseEther("1000")
    );
    await approveRouterTx.wait();

    await this.setState({
      chainConnection: {
        ...this.state.chainConnection,
        provider,
        library,
        chainId: network.chainId,
        address: signerAddress,
        sourceRouterContract,
        sourceTokenContract,
        targetRouterContract,
        connected: true,
      },
    });

    sourceRouterContract.on(
      "TokenLocked",
      async (sender, amount, receivingWalletAddress) => {
        const userLockedAmount = await sourceRouterContract.userToLocked(
          sender,
          sourceTokenAddress
        );

        await this.setState({
          chainConnection: {
            ...this.state.chainConnection,
            web3Modal: new Web3Modal({
              network: "any",
              cacheProvider: false,
              providerOptions: this.getProviderOptions(),
            }),
          },
        });
    
        const provider = await this.state.chainConnection.web3Modal.connect();

        await this.setState({
          chainConnection: {
            ...this.state.chainConnection,
            provider
        }});

        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x3' }], // chainId must be in hexadecimal numbers
        });

        const library = new Web3Provider(provider);

        const signerAddress = await library.getSigner().getAddress();

        const network = await library.getNetwork();

        await this.setState({
          chainConnection: {
            ...this.state.chainConnection,
            provider,
            library,
            chainId: network.chainId,
            address: signerAddress,
            connected: true,
          },
        });

        await this.setState({ claimable: { amount: formatEther(userLockedAmount) } });

        await this.setState({
          chainConnection: {
            ...this.state.chainConnection,
            chainId: 3,
            web3Modal: new Web3Modal({
              network: this.getNetwork(3),
              cacheProvider: true,
              providerOptions: this.getProviderOptions(),
            }),
          },
        });
      }
    );
    await this.setState({fetching: false})    
    // LMTRouterContract.on("LMTTokenReleased", async (amount) => {
    //   await this.setState({
    //     appleToLime: {
    //       executed: true,
    //       toBeExecuted: false,
    //     },
    //   });
    // });

    await this.subscribeToProviderEvents(this.state.chainConnection);
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

  public async bridgeAmount() {
    const {
      sourceRouterContract,
      sourceTokenContract,
    } = this.state.chainConnection;
    const sourceValue = this.state.sourceInput;
    try {
      await this.setState({ fetching: true });

      const lockTx = await sourceRouterContract.lock(
        sourceTokenContract.address,
        parseEther(sourceValue)
      );
      await lockTx.wait();
      await this.setState({ fetching: false });
    } catch (e) {
      await this.setState({ fetching: false });
      return false;
    }
    return true;
  }

  public async claim() {
    console.log(this.state.chainConnection.targetRouterContract.address)
    await this.setState({ fetching: true });
    try {
      const claimTx = await this.state.chainConnection.targetRouterContract.claim(
      this.state.chainConnection.address,
      this.state.chainConnection.sourceTokenContract.address,
      parseEther(this.state.claimable.claimed)
    );
    await claimTx.wait();
    } catch(e) {
      await this.setState({ fetching: false });
      return false;
    }
    return true
  };

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
            connected={this.state.chainConnection.connected}
            chainConnData={this.state.chainConnection}
            killSession={() => this.resetApp(this.state.chainConnection)}
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
                {!this.state.chainConnection.connected ? (
                  <>
                    <ConnectButton
                      title="Connect to Wallet"
                      onClick={this.onConnect}
                    />
                  </>
                ) : (
                  <></>
                )}
                {this.state.chainConnection.connected ? (
                  <>
                    <Input
                      disabled={false}
                      name="lime-field"
                      placeholder="LMT Amount"
                      onChange={async (e) =>
                        await this.setState({ sourceInput: e.target.value })
                      }
                    />
                    <Input
                      disabled={!this.state.claimable.amount}
                      name="apple-field"
                      placeholder="wLMT Amount"
                      value={this.state.claimable.amount}
                      onChange={async (e) =>
                        await this.setState({
                          claimable: {
                            ...this.state.claimable,
                            claimed: e.target.value,
                          },
                        })
                      }
                    />
                    {this.state.claimable.amount ? (
                      <ConnectButton
                        title="Claim"
                        onClick={async () => {
                          await this.setState({
                            error: await !this.claim(),
                          });
                        }}
                      />
                    ) : (
                      <ConnectButton
                        title="Swap"
                        onClick={async () => {
                          await this.setState({
                            error: await !this.bridgeAmount(),
                          });

                          const balanceLime = formatEther(
                            await this.state.chainConnection.sourceTokenContract.balanceOf(
                              this.state.chainConnection.address
                            )
                          );
                          console.log(balanceLime);
                        }}
                      />
                    )}
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
