import { readFileSync } from "fs";
import path from "path";
import {
  TransactionHash,
  GenLayerClient,
  DecodedDeployData,
  GenLayerChain,
} from "genlayer-js/types";
import { localnet } from "genlayer-js/chains";

export const isSuccessfulDeploymentReceipt = (receipt: {
  status?: number | string;
  statusName?: string;
  txExecutionResultName?: string;
}): boolean => {
  return receipt.statusName === "FINALIZED" && receipt.txExecutionResultName === "FINISHED_WITH_RETURN";
};

export default async function main(client: GenLayerClient<any>) {
  const filePath = path.resolve(process.cwd(), "contracts/intent_lock.py");

  try {
    const contractCode = new Uint8Array(readFileSync(filePath));

    await client.initializeConsensusSmartContract();

    const deployTransaction = await client.deployContract({
      code: contractCode,
      args: [],
    });

    const receipt = await client.waitForTransactionReceipt({
      hash: deployTransaction as TransactionHash,
      waitUntil: "finalized",
      retries: 200,
    });

    if (!isSuccessfulDeploymentReceipt(receipt)) {
      throw new Error(`Deployment failed. Receipt: ${JSON.stringify(receipt)}`);
    }

    const deployedContractAddress =
      (client.chain as GenLayerChain).id === localnet.id
        ? receipt.data?.contract_address
        : (receipt.txDataDecoded as DecodedDeployData)?.contractAddress;

    if (!deployedContractAddress) {
      throw new Error("Deployment receipt did not contain a contract address");
    }

    console.log(`Contract deployed at address: ${deployedContractAddress}`);
  } catch (error) {
    throw new Error(`Error during deployment:, ${error}`);
  }
}
