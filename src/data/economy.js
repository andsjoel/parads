export const COIN_CURRENCY = "coins";
export const INITIAL_COIN_BALANCE = 5;

export function coinPrice(amount) {
  return {
    currency: COIN_CURRENCY,
    amount,
  };
}

export function getPriceAmount(item, currency = COIN_CURRENCY) {
  if (item?.price?.currency !== currency) return null;
  return item.price.amount;
}
