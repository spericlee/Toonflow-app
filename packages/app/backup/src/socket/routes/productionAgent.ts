import { GlobalContext } from "@/socket/type";
import jwt from "jsonwebtoken";
import u from "@/utils";
import { Namespace, Socket } from "socket.io";
import { ChatMessagesData } from "@/socket/chatMessagesData";
import * as agent from "@/agents/productionAgent/index";
import ChatKit from "@/socket/chatKit";

async function verifyToken(rawToken: string): Promise<Boolean> {
  const setting = await u.db("o_setting").where("key", "tokenKey").select("value").first();
  if (!setting) return false;
  const { value: tokenKey } = setting;
  if (!rawToken) return false;
  const token = rawToken.replace("Bearer ", "");
  try {
    jwt.verify(token, tokenKey as string);
    return true;
  } catch (err) {
    return false;
  }
}

export default (nsp: Namespace) => {
  nsp.on("connection", async (socket: Socket) => {
    console.log("[productionAgent] 已连接:", socket.id);

    const globalContext: GlobalContext = {
      remoteTools: [],
      abortSignal: new AbortController(),
      socket: socket,
      kit: undefined as any,
      isolationKey: "123",
      projectId: 1777638289380,
      thinkLevel: 0,
      messages: [],
    };

    globalContext.kit = new ChatKit(globalContext.messages, {
      onChange: (messages: ChatMessagesData[]) => socket.emit("syncMessages", messages),
    });

    socket.on("remoteTools", async (remoteTools) => (globalContext.remoteTools = remoteTools));

    socket.on("syncMessages", (messages: ChatMessagesData[]) => {
      globalContext.messages = messages;
    });

    socket.on("chat", async (text: string) => {
      const userBox = globalContext.kit.user();
      userBox.text(text).end();
      agent.runDecisionAI(globalContext, text);
    });
  });
  nsp.on("disconnect", (socket: Socket) => {
    console.log("[productionAgent] 已断开连接:", socket.id);
  });
};
