import { ChatCompletionChunk } from "@azure/openai/types";

export const simpleChat: ChatCompletionChunk[] = [
  {
    "choices": [],
    "created": 0,
    "id": "",
    "model": "",
    // @ts-expect-error - Azure OpenAI SDK has incorrect type for object.
    "object": "",
    "prompt_filter_results": [
      {
        "prompt_index": 0,
        "content_filter_results": {
          "hate": {
            "filtered": false,
            "severity": "safe"
          },
          "self_harm": {
            "filtered": false,
            "severity": "safe"
          },
          "sexual": {
            "filtered": false,
            "severity": "safe"
          },
          "violence": {
            "filtered": false,
            "severity": "safe"
          }
        }
      }
    ]
  },
  {
    "choices": [
      {
        "content_filter_results": {},
        "delta": {
          "content": "",
          "refusal": null,
          "role": "assistant"
        },
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "created": 1748977994,
    "id": "chatcmpl-BeRMQ69PcNQmy9a0f0C0VlLsdOy9H",
    "model": "gpt-4o-2024-05-13",
    "object": "chat.completion.chunk",
    "system_fingerprint": "fp_ee1d74bde0"
  },
  {
    "choices": [
      {
        "content_filter_results": {
          "hate": {
            "filtered": false,
            "severity": "safe"
          },
          "self_harm": {
            "filtered": false,
            "severity": "safe"
          },
          "sexual": {
            "filtered": false,
            "severity": "safe"
          },
          "violence": {
            "filtered": false,
            "severity": "safe"
          }
        },
        "delta": {
          "content": "Hello"
        },
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "created": 1748977994,
    "id": "chatcmpl-BeRMQ69PcNQmy9a0f0C0VlLsdOy9H",
    "model": "gpt-4o-2024-05-13",
    "object": "chat.completion.chunk",
    "system_fingerprint": "fp_ee1d74bde0"
  },
  {
    "choices": [
      {
        "content_filter_results": {
          "hate": {
            "filtered": false,
            "severity": "safe"
          },
          "self_harm": {
            "filtered": false,
            "severity": "safe"
          },
          "sexual": {
            "filtered": false,
            "severity": "safe"
          },
          "violence": {
            "filtered": false,
            "severity": "safe"
          }
        },
        "delta": {
          "content": "!"
        },
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "created": 1748977994,
    "id": "chatcmpl-BeRMQ69PcNQmy9a0f0C0VlLsdOy9H",
    "model": "gpt-4o-2024-05-13",
    "object": "chat.completion.chunk",
    "system_fingerprint": "fp_ee1d74bde0"
  },
  {
    "choices": [
      {
        "content_filter_results": {
          "hate": {
            "filtered": false,
            "severity": "safe"
          },
          "self_harm": {
            "filtered": false,
            "severity": "safe"
          },
          "sexual": {
            "filtered": false,
            "severity": "safe"
          },
          "violence": {
            "filtered": false,
            "severity": "safe"
          }
        },
        "delta": {
          "content": " I'm"
        },
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "created": 1748977994,
    "id": "chatcmpl-BeRMQ69PcNQmy9a0f0C0VlLsdOy9H",
    "model": "gpt-4o-2024-05-13",
    "object": "chat.completion.chunk",
    "system_fingerprint": "fp_ee1d74bde0"
  },
  {
    "choices": [
      {
        "content_filter_results": {
          "hate": {
            "filtered": false,
            "severity": "safe"
          },
          "self_harm": {
            "filtered": false,
            "severity": "safe"
          },
          "sexual": {
            "filtered": false,
            "severity": "safe"
          },
          "violence": {
            "filtered": false,
            "severity": "safe"
          }
        },
        "delta": {
          "content": " just"
        },
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "created": 1748977994,
    "id": "chatcmpl-BeRMQ69PcNQmy9a0f0C0VlLsdOy9H",
    "model": "gpt-4o-2024-05-13",
    "object": "chat.completion.chunk",
    "system_fingerprint": "fp_ee1d74bde0"
  },
  {
    "choices": [
      {
        "content_filter_results": {
          "hate": {
            "filtered": false,
            "severity": "safe"
          },
          "self_harm": {
            "filtered": false,
            "severity": "safe"
          },
          "sexual": {
            "filtered": false,
            "severity": "safe"
          },
          "violence": {
            "filtered": false,
            "severity": "safe"
          }
        },
        "delta": {
          "content": " a"
        },
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "created": 1748977994,
    "id": "chatcmpl-BeRMQ69PcNQmy9a0f0C0VlLsdOy9H",
    "model": "gpt-4o-2024-05-13",
    "object": "chat.completion.chunk",
    "system_fingerprint": "fp_ee1d74bde0"
  },
  {
    "choices": [
      {
        "content_filter_results": {
          "hate": {
            "filtered": false,
            "severity": "safe"
          },
          "self_harm": {
            "filtered": false,
            "severity": "safe"
          },
          "sexual": {
            "filtered": false,
            "severity": "safe"
          },
          "violence": {
            "filtered": false,
            "severity": "safe"
          }
        },
        "delta": {
          "content": " computer"
        },
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "created": 1748977994,
    "id": "chatcmpl-BeRMQ69PcNQmy9a0f0C0VlLsdOy9H",
    "model": "gpt-4o-2024-05-13",
    "object": "chat.completion.chunk",
    "system_fingerprint": "fp_ee1d74bde0"
  },
  {
    "choices": [
      {
        "content_filter_results": {
          "hate": {
            "filtered": false,
            "severity": "safe"
          },
          "self_harm": {
            "filtered": false,
            "severity": "safe"
          },
          "sexual": {
            "filtered": false,
            "severity": "safe"
          },
          "violence": {
            "filtered": false,
            "severity": "safe"
          }
        },
        "delta": {
          "content": " program"
        },
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "created": 1748977994,
    "id": "chatcmpl-BeRMQ69PcNQmy9a0f0C0VlLsdOy9H",
    "model": "gpt-4o-2024-05-13",
    "object": "chat.completion.chunk",
    "system_fingerprint": "fp_ee1d74bde0"
  },
  {
    "choices": [
      {
        "content_filter_results": {
          "hate": {
            "filtered": false,
            "severity": "safe"
          },
          "self_harm": {
            "filtered": false,
            "severity": "safe"
          },
          "sexual": {
            "filtered": false,
            "severity": "safe"
          },
          "violence": {
            "filtered": false,
            "severity": "safe"
          }
        },
        "delta": {
          "content": ","
        },
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "created": 1748977994,
    "id": "chatcmpl-BeRMQ69PcNQmy9a0f0C0VlLsdOy9H",
    "model": "gpt-4o-2024-05-13",
    "object": "chat.completion.chunk",
    "system_fingerprint": "fp_ee1d74bde0"
  },
  {
    "choices": [
      {
        "content_filter_results": {
          "hate": {
            "filtered": false,
            "severity": "safe"
          },
          "self_harm": {
            "filtered": false,
            "severity": "safe"
          },
          "sexual": {
            "filtered": false,
            "severity": "safe"
          },
          "violence": {
            "filtered": false,
            "severity": "safe"
          }
        },
        "delta": {
          "content": " so"
        },
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "created": 1748977994,
    "id": "chatcmpl-BeRMQ69PcNQmy9a0f0C0VlLsdOy9H",
    "model": "gpt-4o-2024-05-13",
    "object": "chat.completion.chunk",
    "system_fingerprint": "fp_ee1d74bde0"
  },
  {
    "choices": [
      {
        "content_filter_results": {
          "hate": {
            "filtered": false,
            "severity": "safe"
          },
          "self_harm": {
            "filtered": false,
            "severity": "safe"
          },
          "sexual": {
            "filtered": false,
            "severity": "safe"
          },
          "violence": {
            "filtered": false,
            "severity": "safe"
          }
        },
        "delta": {
          "content": " I"
        },
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "created": 1748977994,
    "id": "chatcmpl-BeRMQ69PcNQmy9a0f0C0VlLsdOy9H",
    "model": "gpt-4o-2024-05-13",
    "object": "chat.completion.chunk",
    "system_fingerprint": "fp_ee1d74bde0"
  },
  {
    "choices": [
      {
        "content_filter_results": {
          "hate": {
            "filtered": false,
            "severity": "safe"
          },
          "self_harm": {
            "filtered": false,
            "severity": "safe"
          },
          "sexual": {
            "filtered": false,
            "severity": "safe"
          },
          "violence": {
            "filtered": false,
            "severity": "safe"
          }
        },
        "delta": {
          "content": " don't"
        },
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "created": 1748977994,
    "id": "chatcmpl-BeRMQ69PcNQmy9a0f0C0VlLsdOy9H",
    "model": "gpt-4o-2024-05-13",
    "object": "chat.completion.chunk",
    "system_fingerprint": "fp_ee1d74bde0"
  },
  {
    "choices": [
      {
        "content_filter_results": {
          "hate": {
            "filtered": false,
            "severity": "safe"
          },
          "self_harm": {
            "filtered": false,
            "severity": "safe"
          },
          "sexual": {
            "filtered": false,
            "severity": "safe"
          },
          "violence": {
            "filtered": false,
            "severity": "safe"
          }
        },
        "delta": {
          "content": " have"
        },
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "created": 1748977994,
    "id": "chatcmpl-BeRMQ69PcNQmy9a0f0C0VlLsdOy9H",
    "model": "gpt-4o-2024-05-13",
    "object": "chat.completion.chunk",
    "system_fingerprint": "fp_ee1d74bde0"
  },
  {
    "choices": [
      {
        "content_filter_results": {
          "hate": {
            "filtered": false,
            "severity": "safe"
          },
          "self_harm": {
            "filtered": false,
            "severity": "safe"
          },
          "sexual": {
            "filtered": false,
            "severity": "safe"
          },
          "violence": {
            "filtered": false,
            "severity": "safe"
          }
        },
        "delta": {
          "content": " feelings"
        },
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "created": 1748977994,
    "id": "chatcmpl-BeRMQ69PcNQmy9a0f0C0VlLsdOy9H",
    "model": "gpt-4o-2024-05-13",
    "object": "chat.completion.chunk",
    "system_fingerprint": "fp_ee1d74bde0"
  },
  {
    "choices": [
      {
        "content_filter_results": {
          "hate": {
            "filtered": false,
            "severity": "safe"
          },
          "self_harm": {
            "filtered": false,
            "severity": "safe"
          },
          "sexual": {
            "filtered": false,
            "severity": "safe"
          },
          "violence": {
            "filtered": false,
            "severity": "safe"
          }
        },
        "delta": {
          "content": ","
        },
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "created": 1748977994,
    "id": "chatcmpl-BeRMQ69PcNQmy9a0f0C0VlLsdOy9H",
    "model": "gpt-4o-2024-05-13",
    "object": "chat.completion.chunk",
    "system_fingerprint": "fp_ee1d74bde0"
  },
  {
    "choices": [
      {
        "content_filter_results": {
          "hate": {
            "filtered": false,
            "severity": "safe"
          },
          "self_harm": {
            "filtered": false,
            "severity": "safe"
          },
          "sexual": {
            "filtered": false,
            "severity": "safe"
          },
          "violence": {
            "filtered": false,
            "severity": "safe"
          }
        },
        "delta": {
          "content": " but"
        },
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "created": 1748977994,
    "id": "chatcmpl-BeRMQ69PcNQmy9a0f0C0VlLsdOy9H",
    "model": "gpt-4o-2024-05-13",
    "object": "chat.completion.chunk",
    "system_fingerprint": "fp_ee1d74bde0"
  },
  {
    "choices": [
      {
        "content_filter_results": {
          "hate": {
            "filtered": false,
            "severity": "safe"
          },
          "self_harm": {
            "filtered": false,
            "severity": "safe"
          },
          "sexual": {
            "filtered": false,
            "severity": "safe"
          },
          "violence": {
            "filtered": false,
            "severity": "safe"
          }
        },
        "delta": {
          "content": " I'm"
        },
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "created": 1748977994,
    "id": "chatcmpl-BeRMQ69PcNQmy9a0f0C0VlLsdOy9H",
    "model": "gpt-4o-2024-05-13",
    "object": "chat.completion.chunk",
    "system_fingerprint": "fp_ee1d74bde0"
  },
  {
    "choices": [
      {
        "content_filter_results": {
          "hate": {
            "filtered": false,
            "severity": "safe"
          },
          "self_harm": {
            "filtered": false,
            "severity": "safe"
          },
          "sexual": {
            "filtered": false,
            "severity": "safe"
          },
          "violence": {
            "filtered": false,
            "severity": "safe"
          }
        },
        "delta": {
          "content": " here"
        },
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "created": 1748977994,
    "id": "chatcmpl-BeRMQ69PcNQmy9a0f0C0VlLsdOy9H",
    "model": "gpt-4o-2024-05-13",
    "object": "chat.completion.chunk",
    "system_fingerprint": "fp_ee1d74bde0"
  },
  {
    "choices": [
      {
        "content_filter_results": {
          "hate": {
            "filtered": false,
            "severity": "safe"
          },
          "self_harm": {
            "filtered": false,
            "severity": "safe"
          },
          "sexual": {
            "filtered": false,
            "severity": "safe"
          },
          "violence": {
            "filtered": false,
            "severity": "safe"
          }
        },
        "delta": {
          "content": " and"
        },
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "created": 1748977994,
    "id": "chatcmpl-BeRMQ69PcNQmy9a0f0C0VlLsdOy9H",
    "model": "gpt-4o-2024-05-13",
    "object": "chat.completion.chunk",
    "system_fingerprint": "fp_ee1d74bde0"
  },
  {
    "choices": [
      {
        "content_filter_results": {
          "hate": {
            "filtered": false,
            "severity": "safe"
          },
          "self_harm": {
            "filtered": false,
            "severity": "safe"
          },
          "sexual": {
            "filtered": false,
            "severity": "safe"
          },
          "violence": {
            "filtered": false,
            "severity": "safe"
          }
        },
        "delta": {
          "content": " ready"
        },
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "created": 1748977994,
    "id": "chatcmpl-BeRMQ69PcNQmy9a0f0C0VlLsdOy9H",
    "model": "gpt-4o-2024-05-13",
    "object": "chat.completion.chunk",
    "system_fingerprint": "fp_ee1d74bde0"
  },
  {
    "choices": [
      {
        "content_filter_results": {
          "hate": {
            "filtered": false,
            "severity": "safe"
          },
          "self_harm": {
            "filtered": false,
            "severity": "safe"
          },
          "sexual": {
            "filtered": false,
            "severity": "safe"
          },
          "violence": {
            "filtered": false,
            "severity": "safe"
          }
        },
        "delta": {
          "content": " to"
        },
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "created": 1748977994,
    "id": "chatcmpl-BeRMQ69PcNQmy9a0f0C0VlLsdOy9H",
    "model": "gpt-4o-2024-05-13",
    "object": "chat.completion.chunk",
    "system_fingerprint": "fp_ee1d74bde0"
  },
  {
    "choices": [
      {
        "content_filter_results": {
          "hate": {
            "filtered": false,
            "severity": "safe"
          },
          "self_harm": {
            "filtered": false,
            "severity": "safe"
          },
          "sexual": {
            "filtered": false,
            "severity": "safe"
          },
          "violence": {
            "filtered": false,
            "severity": "safe"
          }
        },
        "delta": {
          "content": " help"
        },
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "created": 1748977994,
    "id": "chatcmpl-BeRMQ69PcNQmy9a0f0C0VlLsdOy9H",
    "model": "gpt-4o-2024-05-13",
    "object": "chat.completion.chunk",
    "system_fingerprint": "fp_ee1d74bde0"
  },
  {
    "choices": [
      {
        "content_filter_results": {
          "hate": {
            "filtered": false,
            "severity": "safe"
          },
          "self_harm": {
            "filtered": false,
            "severity": "safe"
          },
          "sexual": {
            "filtered": false,
            "severity": "safe"
          },
          "violence": {
            "filtered": false,
            "severity": "safe"
          }
        },
        "delta": {
          "content": " you"
        },
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "created": 1748977994,
    "id": "chatcmpl-BeRMQ69PcNQmy9a0f0C0VlLsdOy9H",
    "model": "gpt-4o-2024-05-13",
    "object": "chat.completion.chunk",
    "system_fingerprint": "fp_ee1d74bde0"
  },
  {
    "choices": [
      {
        "content_filter_results": {
          "hate": {
            "filtered": false,
            "severity": "safe"
          },
          "self_harm": {
            "filtered": false,
            "severity": "safe"
          },
          "sexual": {
            "filtered": false,
            "severity": "safe"
          },
          "violence": {
            "filtered": false,
            "severity": "safe"
          }
        },
        "delta": {
          "content": "."
        },
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "created": 1748977994,
    "id": "chatcmpl-BeRMQ69PcNQmy9a0f0C0VlLsdOy9H",
    "model": "gpt-4o-2024-05-13",
    "object": "chat.completion.chunk",
    "system_fingerprint": "fp_ee1d74bde0"
  },
  {
    "choices": [
      {
        "content_filter_results": {
          "hate": {
            "filtered": false,
            "severity": "safe"
          },
          "self_harm": {
            "filtered": false,
            "severity": "safe"
          },
          "sexual": {
            "filtered": false,
            "severity": "safe"
          },
          "violence": {
            "filtered": false,
            "severity": "safe"
          }
        },
        "delta": {
          "content": " How"
        },
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "created": 1748977994,
    "id": "chatcmpl-BeRMQ69PcNQmy9a0f0C0VlLsdOy9H",
    "model": "gpt-4o-2024-05-13",
    "object": "chat.completion.chunk",
    "system_fingerprint": "fp_ee1d74bde0"
  },
  {
    "choices": [
      {
        "content_filter_results": {
          "hate": {
            "filtered": false,
            "severity": "safe"
          },
          "self_harm": {
            "filtered": false,
            "severity": "safe"
          },
          "sexual": {
            "filtered": false,
            "severity": "safe"
          },
          "violence": {
            "filtered": false,
            "severity": "safe"
          }
        },
        "delta": {
          "content": " can"
        },
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "created": 1748977994,
    "id": "chatcmpl-BeRMQ69PcNQmy9a0f0C0VlLsdOy9H",
    "model": "gpt-4o-2024-05-13",
    "object": "chat.completion.chunk",
    "system_fingerprint": "fp_ee1d74bde0"
  },
  {
    "choices": [
      {
        "content_filter_results": {
          "hate": {
            "filtered": false,
            "severity": "safe"
          },
          "self_harm": {
            "filtered": false,
            "severity": "safe"
          },
          "sexual": {
            "filtered": false,
            "severity": "safe"
          },
          "violence": {
            "filtered": false,
            "severity": "safe"
          }
        },
        "delta": {
          "content": " I"
        },
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "created": 1748977994,
    "id": "chatcmpl-BeRMQ69PcNQmy9a0f0C0VlLsdOy9H",
    "model": "gpt-4o-2024-05-13",
    "object": "chat.completion.chunk",
    "system_fingerprint": "fp_ee1d74bde0"
  },
  {
    "choices": [
      {
        "content_filter_results": {
          "hate": {
            "filtered": false,
            "severity": "safe"
          },
          "self_harm": {
            "filtered": false,
            "severity": "safe"
          },
          "sexual": {
            "filtered": false,
            "severity": "safe"
          },
          "violence": {
            "filtered": false,
            "severity": "safe"
          }
        },
        "delta": {
          "content": " assist"
        },
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "created": 1748977994,
    "id": "chatcmpl-BeRMQ69PcNQmy9a0f0C0VlLsdOy9H",
    "model": "gpt-4o-2024-05-13",
    "object": "chat.completion.chunk",
    "system_fingerprint": "fp_ee1d74bde0"
  },
  {
    "choices": [
      {
        "content_filter_results": {
          "hate": {
            "filtered": false,
            "severity": "safe"
          },
          "self_harm": {
            "filtered": false,
            "severity": "safe"
          },
          "sexual": {
            "filtered": false,
            "severity": "safe"
          },
          "violence": {
            "filtered": false,
            "severity": "safe"
          }
        },
        "delta": {
          "content": " you"
        },
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "created": 1748977994,
    "id": "chatcmpl-BeRMQ69PcNQmy9a0f0C0VlLsdOy9H",
    "model": "gpt-4o-2024-05-13",
    "object": "chat.completion.chunk",
    "system_fingerprint": "fp_ee1d74bde0"
  },
  {
    "choices": [
      {
        "content_filter_results": {
          "hate": {
            "filtered": false,
            "severity": "safe"
          },
          "self_harm": {
            "filtered": false,
            "severity": "safe"
          },
          "sexual": {
            "filtered": false,
            "severity": "safe"
          },
          "violence": {
            "filtered": false,
            "severity": "safe"
          }
        },
        "delta": {
          "content": " today"
        },
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "created": 1748977994,
    "id": "chatcmpl-BeRMQ69PcNQmy9a0f0C0VlLsdOy9H",
    "model": "gpt-4o-2024-05-13",
    "object": "chat.completion.chunk",
    "system_fingerprint": "fp_ee1d74bde0"
  },
  {
    "choices": [
      {
        "content_filter_results": {
          "hate": {
            "filtered": false,
            "severity": "safe"
          },
          "self_harm": {
            "filtered": false,
            "severity": "safe"
          },
          "sexual": {
            "filtered": false,
            "severity": "safe"
          },
          "violence": {
            "filtered": false,
            "severity": "safe"
          }
        },
        "delta": {
          "content": "?"
        },
        "finish_reason": null,
        "index": 0,
        "logprobs": null
      }
    ],
    "created": 1748977994,
    "id": "chatcmpl-BeRMQ69PcNQmy9a0f0C0VlLsdOy9H",
    "model": "gpt-4o-2024-05-13",
    "object": "chat.completion.chunk",
    "system_fingerprint": "fp_ee1d74bde0"
  },
  {
    "choices": [
      {
        "content_filter_results": {},
        "delta": {},
        "finish_reason": "stop",
        "index": 0,
        "logprobs": null
      }
    ],
    "created": 1748977994,
    "id": "chatcmpl-BeRMQ69PcNQmy9a0f0C0VlLsdOy9H",
    "model": "gpt-4o-2024-05-13",
    "object": "chat.completion.chunk",
    "system_fingerprint": "fp_ee1d74bde0"
  }
]