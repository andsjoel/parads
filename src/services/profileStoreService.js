import { doc, runTransaction, serverTimestamp } from "firebase/firestore";

import { db } from "../firebase/firebase";
import { profileBackgroundsCatalog } from "../data/profileBackgroundsCatalog";
import { profilePicsCatalog } from "../data/profilePicsCatalog";
import { profilePicBordersCatalog } from "../data/profilePicBordersCatalog";
import { displayCardsCatalog } from "../data/displayCardsCatalog";

const storeSections = {
  background: { field: "backgrounds", catalog: profileBackgroundsCatalog },
  profilePic: { field: "profilePics", catalog: profilePicsCatalog },
  profilePicBorder: { field: "profilePicBorders", catalog: profilePicBordersCatalog },
  displayCard: { field: "displayCards", catalog: displayCardsCatalog },
};

export async function purchaseProfileItem({ uid, type, itemId }) {
  const section = storeSections[type];
  const item = section?.catalog.find((candidate) => candidate.id === itemId);

  if (!uid || !section || !item) throw new Error("Item inválido.");

  const price = item.price?.amount;
  if (!Number.isInteger(price) || price < 0) throw new Error("Preço inválido.");

  const userRef = doc(db, "users", uid);
  const inventoryRef = doc(db, "user_inventory", uid);

  return runTransaction(db, async (transaction) => {
    const [userSnap, inventorySnap] = await Promise.all([
      transaction.get(userRef),
      transaction.get(inventoryRef),
    ]);

    if (!userSnap.exists() || !inventorySnap.exists()) {
      throw new Error("Conta ou inventário não encontrado.");
    }

    const user = userSnap.data();
    const inventory = inventorySnap.data();
    const ownedItems = inventory[section.field] || [];
    const currentBalance = user.progression?.coins || 0;

    if (ownedItems.includes(itemId)) {
      return { coins: currentBalance, inventory };
    }

    if (currentBalance < price) throw new Error("Saldo insuficiente.");

    const nextInventory = {
      ...inventory,
      [section.field]: [...ownedItems, itemId],
    };
    const nextBalance = currentBalance - price;

    transaction.update(userRef, {
      "progression.coins": nextBalance,
      updatedAt: serverTimestamp(),
    });
    transaction.update(inventoryRef, {
      [section.field]: nextInventory[section.field],
      updatedAt: serverTimestamp(),
    });

    return { coins: nextBalance, inventory: nextInventory };
  });
}
