import BN from 'bn.js';
import { mbjs } from '../config/config';
import { DEPOSIT_CONSTANTS, GAS, YOCTO_PER_BYTE, MINTING_FEE } from '../constants';
import { ERROR_MESSAGES } from '../errorMessages';
import { MintArgs, MintArgsResponse, NearContractCall, TokenMetadata, TOKEN_METHOD_NAMES } from '../types';

/**
 * Mint a token given via reference json on a given contract with a specified owner, amount of copies as well and royalties can be specified via options
 * @param mintArguments {@link MintArgs}
 * @returns contract call to be passed to @mintbase-js/sdk execute method
 */
export const mint = (
  args: MintArgs,
): NearContractCall<MintArgsResponse> => {
  const {
    contractAddress = mbjs.keys.contractAddress,
    metadata,
    ownerId,
    options = {},
    noMedia = false,
    noReference = false,
    noSplits = false,
    tokenIdsToMint,
  } = args;

  const { splits: splitsFromOptions, amount, royaltyPercentage } = options;

  if (contractAddress == null) {
    throw new Error(ERROR_MESSAGES.CONTRACT_ADDRESS);
  }

  // Reference and media need to be present or explicitly opted out of
  if (!noReference && !metadata.reference) {
    throw new Error(ERROR_MESSAGES.NO_REFERENCE);
  }
  if (!noMedia && !metadata.media) {
    throw new Error(ERROR_MESSAGES.NO_MEDIA);
  }

  const cheapClone = (obj: object): Record<string, number> =>
    JSON.parse(JSON.stringify(obj));

  const royalties = splitsFromOptions
    ? cheapClone(splitsFromOptions)
    : null;

  const splits = noSplits
    ? undefined
    : cheapClone(splitsFromOptions);

  if (splits) {
    // FIXME: suggest we use % (ints) vs float here
    // 0.5 -> 5000
    adjustSplitsForContract(splits);
  }

  if (royalties) {
    // FIXME: suggest we use % (ints) vs float here
    // 0.5 -> 5000
    adjustSplitsForContract(royalties, true);
  }

  if (splits && Object.keys(splits).length > 50) {
    throw new Error(ERROR_MESSAGES.MAX_SPLITS);
  }

  if (splits && Object.keys(splits).length < 2) {
    throw new Error(ERROR_MESSAGES.SPLITS);
  }

  if (amount && amount > 125) {
    throw  new Error(ERROR_MESSAGES.MAX_AMOUNT);
  }

  if (royaltyPercentage && royaltyPercentage < 0 || royaltyPercentage > 0.5) {
    throw new Error(ERROR_MESSAGES.INVALID_ROYALTY_PERCENTAGE);
  }

  return {
    contractAddress: contractAddress || mbjs.keys.contractAddress,
    args: {
      owner_id: ownerId,
      metadata: metadata,
      num_to_mint: amount || 1,
      // 10_000 = 100% (see above note)
      royalty_args: !royalties ? null : { split_between: royalties, percentage: royaltyPercentage * 10_000 },
      split_owners: splits || null,
      token_ids_to_mint: tokenIdsToMint,
    },
    methodName: TOKEN_METHOD_NAMES.MINT,
    gas: GAS,
    deposit: mintingDeposit({
      nTokens: amount,
      nRoyalties: !splits ? 0 : Object.keys(splits).length,
      nSplits: splits ? Object.keys(splits).length : 0,
      metadata,
    }),
  };
};

function adjustSplitsForContract(splits: Record<string, number>, isRoyalties = false): void {
  let counter = 0;
  // mutating this is breaking tests
  Object.keys(splits).forEach(key => {
    counter += splits[key];
    splits[key] *= 10_000;
  });
  if (counter != 1 && !isRoyalties) {
    throw new Error (ERROR_MESSAGES.SPLITS_PERCENTAGE);
  }
}

function mintingDeposit({
  nTokens,
  nSplits,
  nRoyalties,
  metadata,
}: {
  nTokens: number;
  nSplits: number;
  nRoyalties: number;
  metadata: TokenMetadata;
}): string {
  const commonDeposit = new BN(DEPOSIT_CONSTANTS.STORE_COMMON);
  const royaltiesDeposit = commonDeposit.mul(new BN(nRoyalties));
  const splitsDeposit = commonDeposit.mul(new BN(nSplits));
  const mintingFee = new BN(MINTING_FEE);

  // JSON serialization should give us an estimate that's always higher than
  // borsh serialization
  const metadataDeposit = new BN(YOCTO_PER_BYTE).mul(new BN(JSON.stringify(metadata).length));
  const depositPerToken = new BN(DEPOSIT_CONSTANTS.STORE_TOKEN).add(splitsDeposit);

  const total = commonDeposit
    .add(mintingFee)
    .add(royaltiesDeposit)
    .add(metadataDeposit)
    .add(new BN(nTokens).mul(depositPerToken));
  return total.toString();
}
