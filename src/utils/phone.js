export function onlyNumbers(value) {
  return value.replace(/\D/g, "");
}

export function normalizeBrazilPhone(value) {
  const digits = onlyNumbers(value);
  const localNumber = digits.startsWith("55") && digits.length === 13
    ? digits.slice(2)
    : digits;

  return localNumber.length === 11 ? `55${localNumber}` : null;
}

export function buildPhoneAuthEmail(phone) {
  const normalizedPhone = normalizeBrazilPhone(phone);

  if (!normalizedPhone) {
    throw new Error("Celular invalido.");
  }

  return `${normalizedPhone}@parads.local`;
}

export function maskPhone(value) {
  const numbers = onlyNumbers(value).slice(0, 11);

  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 3) return `${numbers.slice(0, 2)} ${numbers.slice(2)}`;
  if (numbers.length <= 7) {
    return `${numbers.slice(0, 2)} ${numbers.slice(2, 3)} ${numbers.slice(3)}`;
  }

  return `${numbers.slice(0, 2)} ${numbers.slice(2, 3)} ${numbers.slice(3, 7)}-${numbers.slice(7)}`;
}
