export type VellumIdentityOption = {
  did: string;
  displayName?: string;
  walletId: string;
};

export type VellumIdentityBindingDto = {
  did: string;
  displayName: string | null;
  walletId: string;
};

export function isCurrentVellumIdentitySelection(
  binding: VellumIdentityBindingDto | null,
  selection: VellumIdentityOption | undefined,
): boolean {
  return Boolean(
    binding &&
    selection &&
    binding.did === selection.did &&
    binding.walletId === selection.walletId &&
    binding.displayName === (selection.displayName ?? null),
  );
}
