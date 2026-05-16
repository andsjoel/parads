export const achievementsCatalog = [
  {
    id: "member",
    name: "Membro",
    description: "Entrou para a comunidade e criou sua conta.",
    category: "account",
    type: "badge",
    rarity: "common",
    isUpgradeable: false,

    levels: [
      {
        level: 1,
        name: "Membro",
        description: "Criou sua conta no app.",
        imageId: "badge-common-member-1",
        requirement: {
          type: "account_created",
          value: 1,
        },
      },
    ],
  },
  {
    id: "first_status",
    name: "O que se passa nessa cabeça?",
    description: "Personalizou o status do perfil pela primeira vez.",
    category: "profile",
    type: "badge",
    rarity: "common",
    isUpgradeable: false,
    levels: [
        {
        level: 1,
        name: "O que se passa nessa cabeça?",
        description: "Escreveu seu primeiro status e deixou o perfil com personalidade.",
        imageId: "badge-common-first-status-1",
        requirement: {
            type: "profile_status_changed",
            value: 1,
        },
        },
    ],
    },
];