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
  wrappedTokenContract: any;
  claimable: any;
  releasable: any;
  wrappedBalance: number;
  nativeBalance: number;
  lockedAmount: number;
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
  wrappedTokenContract: null,
  sourceToTarget: {
    source: "lime",
    target: "apple",
  },
  claimable: {
    amount: 0,
    receivingAddress: "",
    connected: false,
  },
  releasable: {
    amount: 0,
    receivingAddress: "",
  },
  wrappedBalance: 0,
  nativeBalance: 0,
  lockedAmount: 0,
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

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x4" }], // chainId must be in hexadecimal numbers
      });
    } catch (e) {
      console.log(e);
      await this.setState({ fetching: false });
      return;
    }

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

    const nativeBalance = parseFloat(
      formatEther(await sourceTokenContract.balanceOf(address))
    );

    const lockedAmount = parseFloat(
      formatEther(
        await sourceTokenContract.balanceOf(sourceRouterContract.address)
      )
    );

    await this.setState({
      chainConnection: {
        ...this.state.chainConnection,
        provider,
        library,
        chainId: network.chainId,
        address,
        connected: true,
      },
      nativeBalance,
      lockedAmount,
      sourceRouterContract,
      sourceTokenContract,
    });

    sourceRouterContract.on(
      "TokenLocked",
      async (senderAddress, amount, tokenContractAddress) => {
        await this.setState({ fetching: true });
        const userLockedAmount = await sourceRouterContract.userToLocked(
          senderAddress,
          sourceTokenAddress
        );
        const lockedAmount = parseFloat(formatEther(userLockedAmount));
        const claimableAmount = lockedAmount - this.state.wrappedBalance
        const nativeBalance = formatEther(
          await sourceTokenContract.balanceOf(senderAddress)
        );
        await this.setState({
          claimable: {
            ...this.state.claimable,
            amount: claimableAmount,
            receivingAddress: senderAddress,
          },
          chainConnection: {
            ...this.state.chainConnection,
          },
          nativeBalance,
          lockedAmount,
          fetching: false,
        });
      }
    );

    sourceRouterContract.on(
      "TokenReleased",
      async (receiverAddress, tokenContractAddress, amount) => {
        const nativeBalance = formatEther(
          await sourceTokenContract.balanceOf(receiverAddress)
        );
        const releasedAmount = parseFloat(formatEther(amount));
        const updatedLockedAmount = this.state.lockedAmount - releasedAmount;
        const updatedReleasableAmount =
          this.state.releasable.amount - releasedAmount;
        const updatedClaimableAmount = updatedLockedAmount - this.state.wrappedBalance;
        await this.setState({
          nativeBalance,
          lockedAmount: updatedLockedAmount,
          releasable: {
            ...this.state.releasable,
            amount: updatedReleasableAmount,
          },
          claimable: {
            ...this.state.claimable,
            amount: updatedClaimableAmount
          }
        });
      }
    );

    await this.setState({ fetching: false });

    await this.subscribeToProviderEvents(this.state.chainConnection);
  };

  public connectToTarget = async () => {
    await this.setState({ fetching: true });

    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x3" }], // chainId must be in hexadecimal numbers
    });

    await this.setState({
      claimable: {
        ...this.state.claimable,
        connected: true,
      },
      chainConnection: {
        ...this.state.chainConnection,
        chainId: 3,
      },
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
      this.state.chainConnection.address
    );

    const userWrappedTokenAddress = await targetRouterContract.nativeToWrapped(
      this.state.sourceTokenContract.address
    );

    const wrappedTokenContract = parseInt(userWrappedTokenAddress, 16)
      ? getContract(
          userWrappedTokenAddress,
          WRAPPED_TOKEN.abi,
          this.state.chainConnection.library,
          this.state.chainConnection.address
        )
      : null;
    const userWrappedBalance = wrappedTokenContract
      ? formatEther(
          await wrappedTokenContract.balanceOf(
            this.state.chainConnection.address
          )
        )
      : "0";

    targetRouterContract.on(
      "TokenClaimed",
      async (
        receiverAddress: string,
        amount: string,
        wrappedTokenAddress: string
      ) => {
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
            ...this.state.claimable,
            amount: updatedClaimableAmount,
          },
          wrappedBalance: formatEther(
            await wrappedTokenContract.balanceOf(receiverAddress)
          ),
          wrappedTokenContract,
          fetching: true,
        });

        await this.setState({ fetching: false });
      }
    );

    targetRouterContract.on(
      "TokenBurned",
      async (sender: string, amount: string, nativeTokenAddress: string) => {
        await this.setState({ fetching: true });

        const parsedAmount = parseFloat(formatEther(amount));

        const parseReleasableAmount = parseInt(
          this.state.releasable.amount.toString(),
          10
        );

        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x4" }], // chainId must be in hexadecimal numbers
          });
        } catch (e) {
          console.log(e);
          await this.setState({ fetching: false });
          return;
        }

        await this.setState({
          chainConnection: {
            ...this.state.chainConnection,
            chainId: 4,
          },
        });

        const updatedReleasableAmount = parseReleasableAmount + parsedAmount;
        const updatedWrappedBalance =
          parseFloat(this.state.wrappedBalance) - parsedAmount;
          const updatedClaimableBalance =
          parseFloat(this.state.lockedAmount) - updatedWrappedBalance;  
        await this.setState({
          releasable: {
            amount: updatedReleasableAmount,
            receivingAddress: sender,
          },
          claimable: {
            ...this.state.claimable,
            amount: updatedClaimableBalance,
            connected: false,
          },
          wrappedBalance: updatedWrappedBalance,
          fetching: false,
        });
      }
    );
    await this.setState({
      targetRouterContract,
      claimable: {
        ...this.state.claimable,
        connected: true,
      },
      wrappedBalance: userWrappedBalance,
      fetching: false,
    });
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
    const { sourceRouterContract, sourceTokenContract } = this.state;

    try {
      await this.setState({ fetching: true });
      const bigNumberAllowance = await sourceTokenContract.allowance(
        this.state.chainConnection.address,
        sourceRouterContract.address
      );
      const allowance = parseFloat(formatEther(bigNumberAllowance));
      const parsedSourceInput = parseFloat(sourceInput);

      if (allowance < parsedSourceInput) {
        await this.setState({ fetching: true });
        const approveRouterTx = await sourceTokenContract.approve(
          sourceRouterContract.address,
          parseEther(`${parsedSourceInput}`)
        );
        await approveRouterTx.wait();
      }

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
    await this.setState({ fetching: true });

    try {
      const claimTx = await targetRouterContract.claim(
        this.state.claimable.receivingAddress,
        this.state.sourceTokenContract.address,
        parseEther(wrappedInput)
      );
      await claimTx.wait();
    } catch (e) {
      console.log(e);
      await this.setState({ fetching: false });
      return false;
    }
    await this.setState({ fetching: false });
    return true;
  }

  public async burn(burnedInput: string) {
    const { targetRouterContract, wrappedTokenContract } = this.state;

    try {
      await this.setState({ fetching: true });
      const allowance = parseFloat(
        formatEther(
          await wrappedTokenContract.allowance(
            this.state.chainConnection.address,
            targetRouterContract.address
          )
        )
      );
      const parsedBurnedInput = parseFloat(burnedInput);

      if (allowance < parsedBurnedInput) {
        await this.setState({ fetching: true });
        const approveRouterTx = await wrappedTokenContract.approve(
          targetRouterContract.address,
          parseEther(`${parsedBurnedInput}`)
        );
        await approveRouterTx.wait();
      }
      const burnTx = await targetRouterContract.burn(
        this.state.wrappedTokenContract.address,
        this.state.sourceTokenContract.address,
        parseEther(burnedInput)
      );
      await burnTx.wait();
    } catch (e) {
      console.log(e);
      await this.setState({ fetching: false });
      return false;
    }
    await this.setState({ fetching: false });
    return true;
  }

  public async release(sourceInput: string, receiverAddress: string) {
    const { sourceRouterContract, sourceTokenContract } = this.state;

    try {
      await this.setState({ fetching: true });

      const releaseTx = await sourceRouterContract.release(
        sourceTokenContract.address,
        receiverAddress,
        parseEther(sourceInput)
      );
      await releaseTx.wait();
      await this.setState({ fetching: false });
    } catch (e) {
      console.log(e);
      await this.setState({ fetching: false });
      return false;
    }
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
            chainConnData={this.state.chainConnection}
            killSession={() => this.resetApp(this.state.chainConnection)}
            wrappedBalance={this.state.wrappedBalance}
            nativeBalance={this.state.nativeBalance}
            lockedAmount={this.state.lockedAmount}
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
                    burn={async (burnedInput: string) =>
                      await this.burn(burnedInput)
                    }
                    release={async (
                      releasedInput: string,
                      receivingAddress: string
                    ) => await this.release(releasedInput, receivingAddress)}
                    claimable={this.state.claimable}
                    wrappedBalance={this.state.wrappedBalance}
                    wrappedTokenExists={
                      this.state.wrappedTokenContract !== null
                    }
                    releasable={this.state.releasable}
                    chainId={this.state.chainConnection.chainId}
                  />
                )}
                {this.state.chainConnection.chainId !== 3 &&
                this.state.claimable.amount ? (
                  <ConnectButton
                    title="Connect to Target Chain"
                    onClick={async () => this.connectToTarget()}
                  />
                ) : (
                  <></>
                )}
                {this.state.chainConnection.chainId !== 4 &&
                this.state.releasable.amount ? (
                  <ConnectButton
                    title="Connect to Native Chain"
                    onClick={async () => this.onConnect()}
                  />
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
