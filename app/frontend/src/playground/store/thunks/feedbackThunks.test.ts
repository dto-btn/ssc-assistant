import { describe, expect, it, beforeEach, vi } from "vitest"
import { sendChatFeedback } from "../../api/feedback"
import { setMessageFeedback } from "../slices/chatSlice"
import { submitResponseFeedback, clearResponseFeedback } from "./feedbackThunks"

vi.mock("../../api/feedback", () => ({
  sendChatFeedback: vi.fn(),
}))

vi.mock("../../../i18n", () => ({
  default: {
    t: (key: string) => key,
  },
}))

describe("feedback thunks", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(sendChatFeedback).mockResolvedValue(undefined)
  })

  it("submits a dislike and updates Redux optimistically", async () => {
    const dispatch = vi.fn()
    const getState = () =>
      ({
        auth: { accessToken: "test-token" },
        chat: {
          messages: [
            {
              id: "m1",
              feedback: "liked",
            },
          ],
        },
      }) as never

    await submitResponseFeedback("s1", "m1", false)(
      dispatch,
      getState,
      undefined,
    )

    expect(sendChatFeedback).toHaveBeenCalledWith({
      accessToken: "test-token",
      sessionId: "s1",
      messageId: "m1",
      feedback: expect.any(String),
    })

    const encodedPayload = vi.mocked(sendChatFeedback).mock.calls[0][0].feedback
    const jsonPayload = encodedPayload.split(",", 2)[1]
    const decodedPayload = JSON.parse(atob(jsonPayload))

    expect(decodedPayload).toMatchObject({
      messageId: "m1",
      sessionId: "s1",
      type: "reaction",
      positive: false,
    })

    expect(dispatch).toHaveBeenCalledWith(
      setMessageFeedback({
        messageId: "m1",
        feedback: "disliked",
      }),
    )
  })
  it("restores the previous reaction when submission fails", async () => {
    vi.mocked(sendChatFeedback).mockRejectedValueOnce(
      new Error("request failed"),
    )

    const dispatch = vi.fn()
    const getState = () =>
      ({
        auth: { accessToken: "test-token" },
        chat: {
          messages: [
            {
              id: "m1",
              feedback: "liked",
            },
          ],
        },
      }) as never

    await submitResponseFeedback("s1", "m1", false)(
      dispatch,
      getState,
      undefined,
    )

    expect(dispatch).toHaveBeenCalledWith(
      setMessageFeedback({
        messageId: "m1",
        feedback: "disliked",
      }),
    )

    expect(dispatch).toHaveBeenCalledWith(
      setMessageFeedback({
        messageId: "m1",
        feedback: "liked",
      }),
    )
  })
  it("removes a reaction and clears Redux feedback", async () => {
    const dispatch = vi.fn()
    const getState = () =>
      ({
        auth: { accessToken: "test-token" },
        chat: {
          messages: [
            {
              id: "m1",
              feedback: "liked",
            },
          ],
        },
      }) as never

    await clearResponseFeedback("s1", "m1")(dispatch, getState, undefined)

    expect(sendChatFeedback).toHaveBeenCalledWith({
      accessToken: "test-token",
      sessionId: "s1",
      messageId: "m1",
      feedback: expect.any(String),
    })

    const encodedPayload = vi.mocked(sendChatFeedback).mock.calls[0][0].feedback
    const jsonPayload = encodedPayload.split(",", 2)[1]
    const decodedPayload = JSON.parse(atob(jsonPayload))

    expect(decodedPayload).toMatchObject({
      messageId: "m1",
      sessionId: "s1",
      type: "reaction",
      positive: null,
    })

    expect(dispatch).toHaveBeenCalledWith(
      setMessageFeedback({
        messageId: "m1",
        feedback: undefined,
      }),
    )
  })
  it("keeps the existing reaction when unreact fails", async () => {
    vi.mocked(sendChatFeedback).mockRejectedValueOnce(
      new Error("request failed"),
    )

    const dispatch = vi.fn()
    const getState = () =>
      ({
        auth: { accessToken: "test-token" },
        chat: {
          messages: [
            {
              id: "m1",
              feedback: "liked",
            },
          ],
        },
      }) as never

    await clearResponseFeedback("s1", "m1")(dispatch, getState, undefined)

    expect(sendChatFeedback).toHaveBeenCalledOnce()

    expect(dispatch).not.toHaveBeenCalledWith(
      setMessageFeedback({
        messageId: "m1",
        feedback: undefined,
      }),
    )
  })
  it("does not submit a reaction without an access token", async () => {
    const dispatch = vi.fn()
    const getState = () =>
      ({
        auth: { accessToken: undefined },
        chat: {
          messages: [
            {
              id: "m1",
              feedback: undefined,
            },
          ],
        },
      }) as never

    await submitResponseFeedback("s1", "m1", true)(
      dispatch,
      getState,
      undefined,
    )

    expect(sendChatFeedback).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalledWith(
      setMessageFeedback({
        messageId: "m1",
        feedback: "liked",
      }),
    )
  })
  it("does not clear a reaction without an access token", async () => {
    const dispatch = vi.fn()
    const getState = () =>
      ({
        auth: { accessToken: undefined },
        chat: {
          messages: [
            {
              id: "m1",
              feedback: "liked",
            },
          ],
        },
      }) as never

    await clearResponseFeedback("s1", "m1")(dispatch, getState, undefined)

    expect(sendChatFeedback).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalledWith(
      setMessageFeedback({
        messageId: "m1",
        feedback: undefined,
      }),
    )
  })
})
