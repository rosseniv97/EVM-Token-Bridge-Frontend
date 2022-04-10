import { Contract } from "ethers/lib/ethers";
import Web3Modal from "web3modal";

export interface IAssetData {
  symbol: string;
  name: string;
  decimals: string;
  contractAddress: string;
  balance?: string;
}

export interface IChainData {
  name: string;
  short_name: string;
  chain: string;
  network: string;
  chain_id: number;
  network_id: number;
  rpc_url: string;
  native_currency: IAssetData;
  explorer?: string;
}

export interface IChainConn {
  web3Modal: Web3Modal;
  provider: any;
  library: any;
  chainId: number;
  address: string;
  sourceRouterContract: Contract;
  sourceTokenContract: Contract;
  targetRouterContract: Contract;
  connected: boolean;
}
