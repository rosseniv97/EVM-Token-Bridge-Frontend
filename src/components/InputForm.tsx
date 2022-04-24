import React, { useState } from "react";
import { Input } from "antd";
import "antd/dist/antd.css";
import ConnectButton from "./ConnectButton";

export default (props: any) => {
  const {
    claim,
    bridgeAmount,
    burn,
    release,
    claimable,
    releasable,
    wrappedBalance,
    wrappedTokenExists,
    chainId,
  } = props;
  const [input, setInput] = useState({
    sourceLockInput: "",
    wrappedInput: "",
    burnedInput: "",
    sourceReleaseInput: "",
  });

  return (
    <>
      {wrappedBalance > 0 && chainId === 3 && wrappedTokenExists ? (
        <>
          <Input
            name="wLime-field"
            value={input.burnedInput}
            placeholder="wLMT Amount"
            onChange={async (e) => {
              if (parseInt(e.target.value, 10) || e.target.value === "") {
                setInput({
                  ...input,
                  burnedInput: e.target.value,
                });
              }
            }}
          />
          <ConnectButton
            title="Burn"
            disabled={
              parseFloat(input.burnedInput) >
                parseFloat(wrappedBalance.toString()) || !input.burnedInput
            }
            onClick={async () => {
              await burn(input.burnedInput);
            }}
          />
        </>
      ) : (
        <></>
      )}

      {claimable.amount > 0 && chainId === 3 ? (
        <>
          <Input
            disabled={!claimable.amount}
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
          <ConnectButton
            title="Claim"
            disabled={
              parseFloat(input.wrappedInput) >
                parseFloat(claimable.amount.toString()) || !input.wrappedInput
            }
            onClick={async (e: Event) => {
              await claim(input.wrappedInput);
            }}
          />
        </>
      ) : (
        <></>
      )}
      {chainId === 4 ? (
        <>
          <Input
            name="lime-field"
            value={input.sourceLockInput}
            placeholder="LMT Amount"
            onChange={async (e) => {
              if (parseInt(e.target.value, 10) || e.target.value === "") {
                setInput({
                  ...input,
                  sourceLockInput: e.target.value,
                });
              }
            }}
          />
          <ConnectButton
            title="Swap"
            disabled={!input.sourceLockInput}
            onClick={async (e: Event) => {
              await bridgeAmount(input.sourceLockInput);
            }}
          />
          {releasable.amount > 0 ? (
            <>
              <Input
                name="lime-release-field"
                placeholder="LMT Amount"
                value={input.sourceReleaseInput}
                onChange={async (e) => {
                  // const maxClaimableAmount = claimable.amount;
                  // if (parseFloat(e.target.value) > claimable.amount) {
                  //   e.target.value = maxClaimableAmount.toString();
                  // }
                  if (parseInt(e.target.value, 10) || e.target.value === "") {
                    setInput({
                      ...input,
                      sourceReleaseInput: e.target.value,
                    });
                  }
                }}
              />
              <ConnectButton
                title="Release"
                disabled={
                  parseFloat(input.sourceReleaseInput) >
                    parseFloat(releasable.amount.toString()) ||
                  !input.sourceReleaseInput
                }
                onClick={async () => {
                  await release(
                    input.sourceReleaseInput,
                    releasable.receivingAddress
                  );
                }}
              />
            </>
          ) : (
            <></>
          )}
        </>
      ) : (
        <></>
      )}
    </>
  );
};
