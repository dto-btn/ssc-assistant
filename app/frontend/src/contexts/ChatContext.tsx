import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import {
  buildDefaultChatHistory,
  buildDefaultModel,
} from "../stores/modelBuilders";

// Using the existing global type definitions for ChatItem and ChatHistory

interface ChatContextType {
  currentChatIndex: number;
  currentChatHistory: ChatHistory | undefined;
  chatHistoriesDescriptions: string[];
  chatIndexToLoadOrDelete: number | null;
  quotedText: string | undefined;
  setChatIndexToLoadOrDelete: (index: number | null) => void;
  getCurrentChatHistory: () => ChatHistory;
  setCurrentChatHistory: (
    param: ChatHistory | ((prev: ChatHistory) => ChatHistory)
  ) => void;
  setDefaultChatHistory: () => void;
  getDefaultModel: () => string;
  setCurrentChatIndex: (index: number) => void;
  setChatHistoriesDescriptions: (descriptions: string[]) => void;
  setQuotedText: (text: string | undefined) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

interface ChatProviderProps {
  children: ReactNode;
}

// Ensures a loaded or incoming ChatHistory has all required keys
const hydrateChatHistory = (raw: ChatHistory | undefined): ChatHistory => {
  const base = buildDefaultChatHistory();
  if (!raw) return base;
  return {
    ...base,
    ...raw,
    chatItems: raw.chatItems || [],
    staticTools: raw.staticTools || [],
    isTopicSet: raw.isTopicSet ?? false,
  };
};

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const [currentChatIndex, setCurrentChatIndexState] = useState<number>(0);
  const [currentChatHistory, setCurrentChatHistoryState] = useState<
    ChatHistory | undefined
  >(buildDefaultChatHistory());
  const [chatHistoriesDescriptions, setChatHistoriesDescriptionsState] =
    useState<string[]>(["Conversation 1"]);
  const [chatIndexToLoadOrDelete, setChatIndexToLoadOrDeleteState] = useState<
    number | null
  >(null);
  const [quotedText, setQuotedTextState] = useState<string | undefined>(
    undefined
  );

  const setChatIndexToLoadOrDelete = useCallback((index: number | null) => {
    setChatIndexToLoadOrDeleteState(index);
  }, []);

  const setQuotedText = useCallback((text: string | undefined) => {
    setQuotedTextState(text);
  }, []);

  const setCurrentChatHistory = useCallback(
    (param: ChatHistory | ((prev: ChatHistory) => ChatHistory)) => {
      if (typeof param === "function") {
        setCurrentChatHistoryState((prevState) => {
          const currentHistory = hydrateChatHistory(prevState);
          return hydrateChatHistory(param(currentHistory));
        });
      } else {
        setCurrentChatHistoryState(hydrateChatHistory(param));
      }
    },
    []
  );

  const setDefaultChatHistory = useCallback(() => {
    setCurrentChatHistoryState(buildDefaultChatHistory());
  }, []);

  const getDefaultModel = useCallback(() => {
    return buildDefaultModel();
  }, []);

  const getCurrentChatHistory = useCallback((): ChatHistory => {
    return hydrateChatHistory(currentChatHistory);
  }, [currentChatHistory]);

  const setCurrentChatIndex = useCallback((index: number) => {
    setCurrentChatIndexState(index);
  }, []);

  const setChatHistoriesDescriptions = useCallback((descriptions: string[]) => {
    setChatHistoriesDescriptionsState(descriptions);
  }, []);

  const contextValue: ChatContextType = useMemo(
    () => ({
      currentChatIndex,
      currentChatHistory: hydrateChatHistory(currentChatHistory), // stable enriched value
      chatHistoriesDescriptions,
      chatIndexToLoadOrDelete,
      quotedText,
      setChatIndexToLoadOrDelete,
      getCurrentChatHistory,
      setCurrentChatHistory,
      setDefaultChatHistory,
      getDefaultModel,
      setCurrentChatIndex,
      setChatHistoriesDescriptions,
      setQuotedText,
    }),
    [
      currentChatIndex,
      currentChatHistory,
      chatHistoriesDescriptions,
      chatIndexToLoadOrDelete,
      quotedText,
      setChatIndexToLoadOrDelete,
      getCurrentChatHistory,
      setCurrentChatHistory,
      setDefaultChatHistory,
      getDefaultModel,
      setCurrentChatIndex,
      setChatHistoriesDescriptions,
      setQuotedText,
    ]
  );

  return (
    <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>
  );
};

export const useChatContext = (): ChatContextType => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return context;
};

// Export the hook with the same name as the original Zustand store for easy migration
export const useChatStore = useChatContext;
