import React, { useState } from "react";
import { Input } from "antd";
import "antd/dist/antd.css";
import ConnectButton from "./ConnectButton";

export default (props: any) => {
  const { claim, bridgeAmount, claimable } = props;
  const [input, setInput] = useState({
    sourceInput: "",
    wrappedInput: "",
    targetInput: "",
  });

  return (
    <>
      <Input
        disabled={false}
        name="lime-field"
        value={input.sourceInput}
        placeholder="LMT Amount"
        onChange={async (e) => {
          if (parseInt(e.target.value, 10) || e.target.value === "") {
            setInput({
              ...input,
              sourceInput: e.target.value,
            });
          }
        }}
      />
      <Input
        // disabled={!claimable.amount}
        name="apple-field"
        placeholder="wLMT Amount"
        value={input.wrappedInput}
        onChange={async (e) => {
          // const maxClaimableAmount = claimable.amount;
          // if (parseFloat(e.target.value) > claimable.amount) {
          //   e.target.value = maxClaimableAmount.toString();
          // }
          if (parseInt(e.target.value, 10) || e.target.value === "") {
            setInput({
              ...input,
              wrappedInput: e.target.value,
            });
          }
        }}
      />
      {claimable.amount ? (
        <ConnectButton
          title="Claim"
          onClick={async () => {
            await claim(input.wrappedInput);
          }}
        />
      ) : (
        <ConnectButton
          title="Swap"
          onClick={async () => {
            await bridgeAmount(input.sourceInput);

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
