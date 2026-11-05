export interface DmUser {
  id: string;
  fullName: string;
  email: string;
  avatarColor: string;
  status: "ONLINE" | "OFFLINE";
  designation: string | null;
  timezone: string | null;
  localTime: string | null;
}

export interface DmMessage {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
}

export interface DmConversation {
  userId: string;
  messages: DmMessage[];
  conversationStartedAt: string;
  isStarred: boolean;
}

export const MOCK_DM_USERS: DmUser[] = [
  {
    id: "mock-user-numan",
    fullName: "Numan Zafar",
    email: "numan@example.com",
    avatarColor: "#f97316",
    status: "ONLINE",
    designation: "Backend Engineer",
    timezone: "Asia/Karachi",
    localTime: "8:42 PM",
  },
  {
    id: "mock-user-mia",
    fullName: "Mia Chen",
    email: "mia@example.com",
    avatarColor: "#8b5cf6",
    status: "ONLINE",
    designation: "Product Designer",
    timezone: "America/New_York",
    localTime: "11:42 AM",
  },
  {
    id: "mock-user-jordan",
    fullName: "Jordan Lee",
    email: "jordan@example.com",
    avatarColor: "#0ea5e9",
    status: "OFFLINE",
    designation: "Frontend Engineer",
    timezone: "America/Los_Angeles",
    localTime: "8:42 AM",
  },
];

export const MOCK_CONVERSATIONS: DmConversation[] = [
  {
    userId: "mock-user-numan",
    conversationStartedAt: "2026-04-10T09:00:00.000Z",
    isStarred: false,
    messages: [
      {
        id: "m1",
        senderId: "__me__",
        text: "hello",
        createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      },
      {
        id: "m2",
        senderId: "mock-user-numan",
        text: "hi",
        createdAt: new Date(Date.now() - 59 * 60 * 1000).toISOString(),
      },
    ],
  },
  {
    userId: "mock-user-mia",
    conversationStartedAt: "2026-04-01T08:00:00.000Z",
    isStarred: true,
    messages: [
      {
        id: "m3",
        senderId: "mock-user-mia",
        text: "Can you check the Figma file I shared?",
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "m4",
        senderId: "__me__",
        text: "On it!",
        createdAt: new Date(Date.now() - 115 * 60 * 1000).toISOString(),
      },
    ],
  },
];

export function getConversation(userId: string): DmConversation | undefined {
  return MOCK_CONVERSATIONS.find((c) => c.userId === userId);
}

export function getDmUser(userId: string): DmUser | undefined {
  return MOCK_DM_USERS.find((u) => u.id === userId);
}
