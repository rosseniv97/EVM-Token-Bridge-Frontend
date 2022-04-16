import * as React from "react";
import styled from "styled-components";
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
import WRAPPED_TOKEN from "./constants/abis/WrappedToken.json";

// import Button from "./components/Button";
import { formatEther, parseEther } from "ethers/lib/utils";
import { Contract } from "ethers/lib/ethers";
import InputForm from "./components/InputForm";

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
  targetRouterContract: Contract;
  sourceRouterContract: Contract;
  sourceTokenContract: Contract;
  claimable: any;
  wrappedBalance: number;
  receivingAddress: any;
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
    connected: false,
  },
  targetRouterContract: new Contract(contracts.APT_ROUTER.address, ROUTER.abi),
  sourceRouterContract: new Contract(contracts.LMT_ROUTER.address, ROUTER.abi),
  sourceTokenContract: new Contract(contracts.LMT_TOKEN.address, ROUTER.abi),
  sourceToTarget: {
    source: "lime",
    target: "apple",
  },
  claimable: {
    amount: 0,
  },
  wrappedBalance: 0,
  receivingAddress: "",
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
    await this.setState({ fetching: true });
    await this.setState({
      chainConnection: {
        ...this.state.chainConnection,
        chainId: 4,
        web3Modal: new Web3Modal({
          network: "any",
          cacheProvider: false,
          providerOptions: this.getProviderOptions(),
        }),
      },
    });

    const provider = await this.state.chainConnection.web3Modal.connect();

    const library = new Web3Provider(provider, "any");

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

    const sourceTokenContract = getContract(
      sourceTokenAddress,
      sourceTokenAbi,
      library,
      address
    );

    // const approveRouterTx = await sourceTokenContract.approve(
    //   sourceRouterContract.address,
    //   parseEther("1000")
    // );
    // await approveRouterTx.wait();

    await this.setState({
      chainConnection: {
        ...this.state.chainConnection,
        provider,
        library,
        chainId: network.chainId,
        address: signerAddress,
        connected: true,
      },
      sourceRouterContract,
      sourceTokenContract,
    });

    sourceRouterContract.on(
      "TokenLocked",
      async (senderAddress, amount, tokenContractAddress) => {
        const userLockedAmount = await sourceRouterContract.userToLocked(
          senderAddress,
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
            provider,
          },
        });

        const library = new Web3Provider(provider, "any");

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

        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x3" }], // chainId must be in hexadecimal numbers
        });

        const targetRouterAddress =
          this.state.sourceToTarget.target === "lime"
            ? contracts.LMT_ROUTER.address
            : this.state.sourceToTarget.target === "apple"
            ? contracts.APT_ROUTER.address
            : "";

        const targetRouterContract = getContract(
          targetRouterAddress,
          ROUTER.abi,
          this.state.chainConnection.library,
          address
        );

        targetRouterContract.on(
          "TokenClaimed",
          async (
            receiverAddress: string,
            amount: string,
            wrappedTokenAddress: string
          ) => {
            console.log(wrappedTokenAddress + " - " + amount);
            const wrappedTokenContract = getContract(
              wrappedTokenAddress,
              WRAPPED_TOKEN.abi,
              this.state.chainConnection.library,
              receiverAddress
            );
            const parsedAmount = parseInt(formatEther(amount), 10);
            const parseClaimableAmount = parseInt(
              this.state.claimable.amount.toString(),
              10
            );
            const updatedClaimableAmount = parseClaimableAmount - parsedAmount;
            await this.setState({
              claimable: {
                amount: updatedClaimableAmount,
              },
              wrappedBalance: formatEther(
                await wrappedTokenContract.balanceOf(receiverAddress)
              ),
            });
          }
        );

        await this.setState({
          claimable: {
            ...this.state.claimable,
            amount: formatEther(userLockedAmount),
          },
          chainConnection: {
            ...this.state.chainConnection,
          },
          receivingAddress: senderAddress,
          targetRouterContract,
        });
      }
    );

    await this.setState({ fetching: false });

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

  public async bridgeAmount(sourceInput: string) {
    console.log("bridge");
    const { sourceRouterContract, sourceTokenContract } = this.state;
    console.log(sourceRouterContract);

    try {
      await this.setState({ fetching: true });

      const lockTx = await sourceRouterContract.lock(
        sourceTokenContract.address,
        parseEther(sourceInput)
      );
      await lockTx.wait();
      await this.setState({ fetching: false });
    } catch (e) {
      console.log(e);
      await this.setState({ fetching: false });
      return false;
    }
    return true;
  }

  public async claim(wrappedInput: string) {
    const { targetRouterContract } = this.state;
    targetRouterContract.on(
      "TokenClaimed",
      async (
        receiverAddress: string,
        amount: string,
        wrappedTokenAddress: string
      ) => {
        console.log(wrappedTokenAddress + " - " + amount);
        const wrappedTokenContract = getContract(
          wrappedTokenAddress,
          WRAPPED_TOKEN.abi,
          this.state.chainConnection.library,
          receiverAddress
        );
        const parsedAmount = parseInt(formatEther(amount), 10);
        const parseClaimableAmount = parseInt(
          this.state.claimable.amount.toString(),
          10
        );
        const updatedClaimableAmount = parseClaimableAmount - parsedAmount;
        await this.setState({
          claimable: {
            amount: updatedClaimableAmount,
          },
          wrappedBalance: formatEther(
            await wrappedTokenContract.balanceOf(receiverAddress)
          ),
        });
      }
    );
    await this.setState({ fetching: true });
    console.log("Amount: " + wrappedInput);
    try {
      const claimTx = await targetRouterContract.claim(
        this.state.receivingAddress,
        this.state.sourceTokenContract.address,
        parseEther(wrappedInput)
      );
      await claimTx.wait();
      console.log(this.state.receivingAddress);
    } catch (e) {
      console.log(e);
      await this.setState({ fetching: false });
      return false;
    }
    await this.setState({ fetching: false });
    return true;
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
                  <InputForm
                    claim={async (wrappedInput: string) =>
                      await this.claim(wrappedInput)
                    }
                    bridgeAmount={async (sourceInput: string) =>
                      await this.bridgeAmount(sourceInput)
                    }
                    claimable={this.state.claimable}
                  />
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
