import React, { useState } from "react";
import { Input } from "antd";
import "antd/dist/antd.css";
import ConnectButton from "./ConnectButton";

export default (props: any) => {
    const { claim, bridgeAmount } = props;
  const [claimable, setClaimable] = useState({
    amount: 0,
    claimed: 0,
  });
  const [input, setInput] = useState({
    sourceInput: "",
    targetInput: "",
  });

  return (
    <>
      <Input
        disabled={false}
        name="lime-field"
        placeholder="LMT Amount"
        onChange={async (e) =>
          setInput({
            ...input,
            sourceInput: e.target.value,
          })
        }
      />
      <Input
        disabled={!claimable.amount}
        name="apple-field"
        placeholder="wLMT Amount"
        value={claimable.claimed}
        onChange={async (e) => {
          const maxClaimableAmount = claimable.amount;
          if (parseFloat(e.target.value) > claimable.amount) {
            e.target.value = maxClaimableAmount.toString();
          }
          setClaimable({
            ...claimable,
            claimed: parseFloat(e.target.value),
          });
        }}
      />
      {claimable.amount ? (
        <ConnectButton
          title="Claim"
          onClick={async () => {
            claim();
          }}
        />
      ) : (
        <ConnectButton
          title="Swap"
          onClick={async () => {
            bridgeAmount()

            // const balanceLime = formatEther(
            //   await sourceTokenContract.balanceOf(
            //     chainConnection.address
            //   )
            // );
            // console.log(balanceLime);
          }}
        />
      )}
    </>
  );
};
