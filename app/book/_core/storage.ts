'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { supabase } from '../../lib/supabase';
import {
  createFragmentId,
  createOwnerId,
  type Fragment,
  type FragmentArtifact,
  type FragmentConsentLevel,
  type FragmentDraft,
  type FragmentPersonaId,
} from './fragments';
import { fallbackFragmentTitle } from './fragments';
import { type PersonaPreferences, createEmptyPreferences } from './personas';
import type { CardId } from './cards';

export type Paragraph = {
  id: string;
  text: string;
  trace: string;
  timestamp: string;
  persona?: FragmentPersonaId;
  artifact?: FragmentArtifact;
  consent_level?: FragmentConsentLevel;
  visibility: 'private' | 'public';
  allow_shopkeeper_review: boolean;
  shopkeeper_comment: string | null;
};

export type PageTrace = {
  id: string;
  content: string;
  persona?: FragmentPersonaId;
  paragraph_id?: string;
  created_at: string;
};

export type PageBookmark = {
  id: string;
  label: string;
  created_at: string;
};

export type PageStatus = 'opening' | 'thinking' | 'resting' | 'archived';

// ── 揭示（P1）────────────────────────────────────────────────
// 一页只揭示一次：用户点「这一页讲完了」之后才有 reveal。
// 缺失 reveal 不是漏数据，是「这页还没被宣告讲完 / 是旧页」。
//   card_id     牌（十张枚举之一）
//   quote       金句——落页
//   card_reading 解读词——不落页，只在翻牌时刻出现
//   persona     解牌人（落款只有名字，落款句不在 P1 范围）
export type PageReveal = {
  card_id: CardId;
  quote: string;
  card_reading: string;
  persona: FragmentPersonaId;
  flipped_at: string;
};

/** 写入揭示时的入参：flipped_at 由 store 补，title 顺带落页眉 */
export type PageRevealInput = Omit<PageReveal, 'flipped_at'> & {
  title?: string;
  flipped_at?: string;
};

export type BookPage = {
  id: string;
  page_number: string;
  title: string;
  status: PageStatus;
  paragraphs: Paragraph[];
  traces: PageTrace[];
  bookmarks: PageBookmark[];
  opened_at: string;
  closed_at: string | null;
  /** 用户宣告「讲完了」的时刻（Echo 段的结束动作，不是 Action） */
  declared_at?: string | null;
  /** 揭示结果；旧页永远没有这个字段，也永远不补 */
  reveal?: PageReveal;
};

export type Book = {
  id: string;
  owner_id: string;
  pages: BookPage[];
};

// ── Legacy Archive ──────────────────────────────────────────
// V4及以前旧书页——归档只读，不参与翻页流程。
export type LegacyParagraph = {
  text: string;
  trace: string;
  persona?: FragmentPersonaId;
  timestamp: string;
};

export type LegacyPage = {
  id: string;
  page_number: string;
  title: string;
  paragraphs: LegacyParagraph[];
  closed_at: string | null;
};

const PAGE_PARAGRAPH_LIMIT = 5;
const PAGE_CHAR_LIMIT = 600;

function createPageId() {
  return `page_${crypto.randomUUID()}`;
}

function createTraceId() {
  return `trace_${crypto.randomUUID()}`;
}

function formatPageNumber(value: number) {
  return String(value).padStart(3, '0');
}

export function createEmptyPage(index: number) {
  const now = new Date().toISOString();
  return {
    id: createPageId(),
    page_number: formatPageNumber(index + 1),
    title: '',
    status: 'opening' as PageStatus,
    paragraphs: [],
    traces: [],
    bookmarks: [],
    opened_at: now,
    closed_at: null,
  } satisfies BookPage;
}

function createInitialBook(ownerId: string): Book {
  return {
    id: `book_${crypto.randomUUID()}`,
    owner_id: ownerId,
    pages: [createEmptyPage(0)],
  };
}

// 把一页旧 BookPage 转成只读陈列页（剥离内部 id 等结构，只留展示需要的字段）
function bookPageToLegacy(page: BookPage): LegacyPage {
  return {
    id: page.id,
    page_number: page.page_number,
    title: page.title,
    closed_at: page.closed_at,
    paragraphs: page.paragraphs.map((paragraph) => ({
      text: paragraph.text,
      trace: paragraph.trace,
      persona: paragraph.persona,
      timestamp: paragraph.timestamp,
    })),
  };
}

function pageParagraphCharCount(page: BookPage) {
  return page.paragraphs.reduce((sum, paragraph) => sum + paragraph.text.length, 0);
}

function pageNeedsTurn(page: BookPage) {
  return page.paragraphs.length >= PAGE_PARAGRAPH_LIMIT || pageParagraphCharCount(page) >= PAGE_CHAR_LIMIT;
}

function paragraphToFragment(paragraph: Paragraph, page: BookPage, ownerId: string): Fragment {
  return {
    id: paragraph.id,
    owner_id: ownerId,
    title: page.title || fallbackFragmentTitle(paragraph.text),
    original_content: paragraph.text,
    narration_content: paragraph.trace,
    visibility: paragraph.visibility,
    allow_shopkeeper_review: paragraph.allow_shopkeeper_review,
    is_featured: false,
    shopkeeper_comment: paragraph.shopkeeper_comment,
    meta: {
      source: 'manual',
      ai_persona: paragraph.persona,
      consent_level: paragraph.consent_level,
      artifact: paragraph.artifact,
    },
    created_at: paragraph.timestamp,
    updated_at: paragraph.timestamp,
  };
}

function buildLegacyFragments(book: Book): Fragment[] {
  return book.pages.flatMap((page) => page.paragraphs.map((paragraph) => paragraphToFragment(paragraph, page, book.owner_id)));
}

export type PageTitleTaskPayload = {
  pageId: string;
  pageNumber: string;
  paragraphs: string[];
};

interface BookState {
  ownerId: string;
  book: Book;
  localFragments: Fragment[];
  legacyArchive: LegacyPage[];
  currentPageIndex: number;
  _hasHydrated: boolean;
  lastSubmitTime: number | null;
  lastOpenedAt: number | null;
  mirrorViewedAt: number | null;
  pendingTitleTask: PageTitleTaskPayload | null;
  personaPreferences: PersonaPreferences;
  setHasHydrated: (state: boolean) => void;
  setLastSubmitTime: (time: number) => void;
  markOpened: () => void;
  markMirrorViewed: () => void;
  setCurrentPageIndex: (index: number) => void;
  openLatestPage: () => void;
  addLocalFragment: (draft: FragmentDraft) => Fragment;
  ensureTrailingBlankPage: () => void;
  mergeShopkeeperComments: (comments: Record<string, string | null>) => void;
  appendParagraphToCurrentPage: (draft: FragmentDraft) => { page: BookPage; paragraph: Paragraph; fragment: Fragment };
  finalizeCurrentPage: (options?: { title?: string; stayOnCurrentPage?: boolean }) => { closedPage: BookPage; nextPage: BookPage } | null;
  setPageStatus: (pageId: string, status: PageStatus) => void;
  setParagraphResponse: (pageId: string, paragraphId: string, response: { narration?: string; persona?: FragmentPersonaId; artifact?: FragmentArtifact }) => void;
  applyPageTitle: (pageId: string, title: string) => void;
  /** 用户宣告「这一页讲完了」。只发生一次；空页没有「讲完」这回事 */
  setPageDeclared: (pageId: string) => void;
  /** 写入揭示（牌＋金句＋解读词＋标题）。一页只揭示一次，已有 reveal 则忽略 */
  setPageReveal: (pageId: string, reveal: PageRevealInput) => void;
  adjustPersonaPreference: (persona: string, delta: 1 | -1) => void;
  /** 导入备份后整体落库：书、旧纸张档案、人格偏好一次写完（P2，2026-10-25） */
  importBackupData: (payload: {
    book: Book;
    legacyArchive: LegacyPage[];
    personaPreferences: PersonaPreferences;
    focusPageId?: string;
  }) => void;
  currentPage: () => BookPage;
  canTurnPage: () => boolean;
}

// ── 迁移（P1：非破坏）────────────────────────────────────────
type PersistedBookState = Partial<BookState> & {
  localFragments?: Fragment[];
  ownerId?: string;
  book?: Book;
  currentPageIndex?: number;
  legacyArchive?: LegacyPage[];
};

/**
 * 结构兼容判定：能判定为「当前结构」，就一页不动地保留。
 * 依据：P1 新增的 reveal / declared_at 全是可选字段，
 * 所以老页天然合规——没有这两个字段恰恰表示「没翻过牌」，不是漏数据。
 *
 * 要求 pages 是非空数组（空数组会让 currentPage() 拿到 undefined），
 * 每页必须有 id / page_number / paragraphs。
 */
function isCompatibleBook(value: unknown): value is Book {
  if (!value || typeof value !== 'object') return false;
  const book = value as Record<string, unknown>;
  if (!Array.isArray(book.pages) || book.pages.length === 0) return false;
  return book.pages.every((page) => {
    if (!page || typeof page !== 'object') return false;
    const record = page as Record<string, unknown>;
    return (
      typeof record.id === 'string' &&
      record.id.length > 0 &&
      typeof record.page_number === 'string' &&
      Array.isArray(record.paragraphs)
    );
  });
}

/**
 * 真正的旧格式迁移：把旧页转成只读陈列页（legacyArchive），再给一本空书。
 * 只有 V4 及以前、或更早的「只有 localFragments」格式会走到这里。
 */
function migrateLegacyState(state: PersistedBookState, ownerId: string): Partial<BookState> {
  // 先重建出旧 book（兼容两种历史格式：已有 book.pages 的 V3，和只有 localFragments 的更早版本）
  let oldBook: Book | null = null;
  try {
    if (Array.isArray(state.book?.pages) && state.book.pages.length > 0) {
      oldBook = state.book;
    } else if (Array.isArray(state.localFragments) && state.localFragments.length > 0) {
      const legacyFragments = [...state.localFragments]
        .filter((item) => !!item && typeof item === 'object')
        .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
      let page: BookPage = createEmptyPage(0);
      const pages: BookPage[] = [];
      for (const item of legacyFragments) {
        const paragraph: Paragraph = {
          id: item.id,
          text: item.original_content,
          trace: item.narration_content,
          timestamp: item.created_at,
          persona: item.meta?.ai_persona,
          artifact: item.meta?.artifact,
          consent_level: item.meta?.consent_level,
          visibility: item.visibility,
          allow_shopkeeper_review: item.allow_shopkeeper_review,
          shopkeeper_comment: item.shopkeeper_comment,
        };
        if (pageNeedsTurn(page) && page.paragraphs.length > 0) {
          pages.push({ ...page, closed_at: paragraph.timestamp });
          page = createEmptyPage(pages.length);
        }
        page = {
          ...page,
          title: page.title || item.title || '',
          paragraphs: [...page.paragraphs, paragraph],
          traces: paragraph.trace
            ? [...page.traces, { id: createTraceId(), content: paragraph.trace, persona: paragraph.persona, paragraph_id: paragraph.id, created_at: paragraph.timestamp }]
            : page.traces,
        };
      }
      pages.push(page);
      oldBook = { id: `book_${crypto.randomUUID()}`, owner_id: ownerId, pages };
    }
  } catch (e) {
    // 旧数据损坏时绝不抛给 persist —— 否则 hydration 永不完成、页面白屏
    console.error('[EndHere Storage] 旧数据迁移失败，已重置为空书:', e);
    oldBook = null;
  }

  // 把有内容的旧页转成陈列页（只读），尾部空白页丢弃
  const legacyArchive: LegacyPage[] = Array.isArray(state.legacyArchive) ? [...state.legacyArchive] : [];
  if (oldBook && Array.isArray(oldBook.pages)) {
    for (const page of oldBook.pages) {
      if (Array.isArray(page.paragraphs) && page.paragraphs.length > 0) {
        legacyArchive.push(bookPageToLegacy(page));
      }
    }
  }

  // 旧格式一律以一本全新的空书起手（旧页已进 legacyArchive，不算丢）
  return {
    ...state,
    ownerId,
    book: createInitialBook(ownerId),
    currentPageIndex: 0,
    localFragments: [],
    legacyArchive,
    pendingTitleTask: null,
  };
}

export const useFragmentStore = create<BookState>()(
  persist(
    (set, get) => {
      const ownerId = createOwnerId();
      const initialBook = createInitialBook(ownerId);

      return {
        ownerId,
        book: initialBook,
        localFragments: [],
        legacyArchive: [],
        currentPageIndex: 0,
        _hasHydrated: false,
        lastSubmitTime: null,
        lastOpenedAt: null,
        mirrorViewedAt: null,
        pendingTitleTask: null,
        personaPreferences: createEmptyPreferences(),
        setHasHydrated: (state) => set({ _hasHydrated: state }),
        setLastSubmitTime: (time) => set({ lastSubmitTime: time }),
        markOpened: () => set({ lastOpenedAt: Date.now() }),
        markMirrorViewed: () => set({ mirrorViewedAt: Date.now() }),
        setCurrentPageIndex: (index) => {
          const maxIndex = get().book.pages.length - 1;
          const nextIndex = Math.max(0, Math.min(index, maxIndex));
          set({ currentPageIndex: nextIndex });
        },
        openLatestPage: () => set({ currentPageIndex: Math.max(0, get().book.pages.length - 1) }),
        currentPage: () => {
          const state = get();
          const index = Math.max(0, Math.min(state.currentPageIndex, state.book.pages.length - 1));
          return state.book.pages[index];
        },
        canTurnPage: () => pageNeedsTurn(get().currentPage()),
        appendParagraphToCurrentPage: (draft) => {
          const now = new Date().toISOString();
          const paragraph: Paragraph = {
            id: createFragmentId(),
            text: draft.original_content,
            trace: draft.narration_content,
            timestamp: now,
            persona: draft.ai_persona,
            artifact: draft.artifact,
            consent_level: draft.consent_level,
            visibility: draft.visibility,
            allow_shopkeeper_review: draft.allow_shopkeeper_review,
            shopkeeper_comment: null,
          };

          let resultPage: BookPage = get().currentPage();
          let resultFragment: Fragment = paragraphToFragment(paragraph, resultPage, get().ownerId);

          set((state) => {
            const pages = [...state.book.pages];
            const pageIndex = Math.max(0, Math.min(state.currentPageIndex, pages.length - 1));
            const currentPage = pages[pageIndex];
            // 写入内容时自动推进到 thinking 状态
            const nextPage: BookPage = {
              ...currentPage,
              status: 'thinking',
              paragraphs: [...currentPage.paragraphs, paragraph],
              traces: paragraph.trace
                ? [
                    ...currentPage.traces,
                    {
                      id: createTraceId(),
                      content: paragraph.trace,
                      persona: paragraph.persona,
                      paragraph_id: paragraph.id,
                      created_at: now,
                    },
                  ]
                : currentPage.traces,
            };
            pages[pageIndex] = nextPage;
            resultPage = nextPage;
            resultFragment = paragraphToFragment(paragraph, nextPage, state.ownerId);
            const nextBook: Book = { ...state.book, pages };
            return {
              book: nextBook,
              localFragments: buildLegacyFragments(nextBook),
              lastSubmitTime: Date.now(),
            };
          });

          syncFragmentToCloud(resultFragment);
          return { page: resultPage, paragraph, fragment: resultFragment };
        },
        addLocalFragment: (draft) => {
          const { fragment } = get().appendParagraphToCurrentPage(draft);
          return fragment;
        },
        finalizeCurrentPage: (options) => {
          const state = get();
          const currentPage = state.currentPage();
          if (currentPage.paragraphs.length === 0) return null;

          const now = new Date().toISOString();
          const pageIndex = state.currentPageIndex;
          const providedTitle = options?.title?.trim();
          const closedPage: BookPage = {
            ...currentPage,
            title: providedTitle || currentPage.title,
            status: 'resting',
            closed_at: now,
          };
          const nextPage = createEmptyPage(state.book.pages.length);
          // 只有未提供 title 时，才触发本地标题提取任务
          const pendingTitleTask: PageTitleTaskPayload | null = providedTitle
            ? null
            : {
                pageId: closedPage.id,
                pageNumber: closedPage.page_number,
                paragraphs: closedPage.paragraphs.map((paragraph) => paragraph.text),
              };

          set((prev) => {
            const nextPages = [...prev.book.pages];
            nextPages[pageIndex] = closedPage;
            nextPages.push(nextPage);
            const nextBook: Book = { ...prev.book, pages: nextPages };
            // 停留模式：不移动 currentPageIndex，让用户留在刚写完的页上，
            // 空白的下一页只作为页码轴上的存在出现。
            const nextCurrentPageIndex = options?.stayOnCurrentPage ? pageIndex : nextPages.length - 1;
            return {
              book: nextBook,
              localFragments: buildLegacyFragments(nextBook),
              pendingTitleTask,
              currentPageIndex: nextCurrentPageIndex,
            };
          });

          return { closedPage, nextPage };
        },
        setPageStatus: (pageId, status) => {
          set((state) => {
            const pages = state.book.pages.map((page) => {
              if (page.id !== pageId) return page;
              const now = new Date().toISOString();
              return {
                ...page,
                status,
                closed_at: status === 'resting' || status === 'archived' ? now : null,
              };
            });
            const nextBook: Book = { ...state.book, pages };
            return {
              book: nextBook,
              localFragments: buildLegacyFragments(nextBook),
            };
          });
        },
        setParagraphResponse: (pageId, paragraphId, response) => {
          set((state) => {
            let touched = false;
            const pages = state.book.pages.map((page) => {
              if (page.id !== pageId) return page;
              const paragraphs = page.paragraphs.map((paragraph) => {
                if (paragraph.id !== paragraphId) return paragraph;
                touched = true;
                const updated: Paragraph = {
                  ...paragraph,
                  trace: response.narration !== undefined ? response.narration : paragraph.trace,
                  persona: response.persona ?? paragraph.persona,
                  artifact: response.artifact ?? paragraph.artifact,
                };
                return updated;
              });
              if (!touched) return page;
              // 同步追加/更新对应 trace 记录
              const traces = response.narration !== undefined
                ? [...page.traces, {
                    id: createTraceId(),
                    content: response.narration,
                    persona: response.persona,
                    paragraph_id: paragraphId,
                    created_at: new Date().toISOString(),
                  }]
                : page.traces;
              return { ...page, paragraphs, traces };
            });
            if (!touched) return state;
            const nextBook: Book = { ...state.book, pages };
            return {
              book: nextBook,
              localFragments: buildLegacyFragments(nextBook),
            };
          });
        },
        ensureTrailingBlankPage: () => {
          const state = get();
          const pages = state.book.pages;
          const lastPage = pages[pages.length - 1];
          // 只有最后一页已关闭(closed_at !== null)时才追加空白页
          // 多轮 reflect 期间页保持打开,不被空白页抢位
          if (lastPage && lastPage.paragraphs.length > 0 && lastPage.closed_at) {
            const nextPage = createEmptyPage(pages.length);
            set({
              book: { ...state.book, pages: [...pages, nextPage] },
              currentPageIndex: pages.length,
            });
          }
        },
        applyPageTitle: (pageId, title) => {
          const normalizedTitle = title.trim();
          if (!normalizedTitle) return;

          set((state) => {
            const pages = state.book.pages.map((page) =>
              page.id === pageId
                ? {
                    ...page,
                    title: normalizedTitle,
                  }
                : page
            );
            const nextBook: Book = { ...state.book, pages };
            return {
              book: nextBook,
              localFragments: buildLegacyFragments(nextBook),
              pendingTitleTask: state.pendingTitleTask?.pageId === pageId ? null : state.pendingTitleTask,
            };
          });
        },
        setPageDeclared: (pageId) => {
          set((state) => {
            let touched = false;
            const pages = state.book.pages.map((page) => {
              if (page.id !== pageId) return page;
              // 宣告只发生一次；空页没有「讲完」这回事
              if (page.declared_at || page.paragraphs.length === 0) return page;
              touched = true;
              return { ...page, declared_at: new Date().toISOString() };
            });
            if (!touched) return state;
            const nextBook: Book = { ...state.book, pages };
            return {
              book: nextBook,
              localFragments: buildLegacyFragments(nextBook),
            };
          });
        },
        setPageReveal: (pageId, input) => {
          const now = new Date().toISOString();
          set((state) => {
            let touched = false;
            const pages = state.book.pages.map((page) => {
              if (page.id !== pageId) return page;
              // 一页只揭示一次：已有 reveal 就原样返回（重试 / 换一个 都不再翻牌）
              if (page.reveal || page.paragraphs.length === 0) return page;
              touched = true;
              const title = input.title?.trim();
              return {
                ...page,
                title: title || page.title,
                declared_at: page.declared_at || now,
                reveal: {
                  card_id: input.card_id,
                  quote: input.quote,
                  card_reading: input.card_reading,
                  persona: input.persona,
                  flipped_at: input.flipped_at || now,
                },
              };
            });
            if (!touched) return state;
            const nextBook: Book = { ...state.book, pages };
            return {
              book: nextBook,
              localFragments: buildLegacyFragments(nextBook),
            };
          });
        },
        adjustPersonaPreference: (persona, delta) => {
          set((state) => {
            const key = persona as keyof PersonaPreferences;
            if (!(key in state.personaPreferences)) return state;
            return {
              personaPreferences: {
                ...state.personaPreferences,
                [key]: (state.personaPreferences[key] || 0) + delta,
              },
            };
          });
        },
        importBackupData: (payload) => {
          set((state) => {
            let pages = payload.book.pages;
            // 导入后如果末尾没有可写的空页，补一个——否则用户导完就没地方写了
            const last = pages[pages.length - 1];
            if (last && last.paragraphs.length > 0 && last.closed_at) {
              pages = [...pages, createEmptyPage(pages.length)];
            }
            const focusIndex = payload.focusPageId
              ? Math.max(0, pages.findIndex((page) => page.id === payload.focusPageId))
              : Math.max(0, Math.min(state.currentPageIndex, pages.length - 1));
            const nextBook: Book = { ...payload.book, owner_id: state.ownerId, pages };
            return {
              book: nextBook,
              localFragments: buildLegacyFragments(nextBook),
              legacyArchive: payload.legacyArchive,
              personaPreferences: payload.personaPreferences,
              currentPageIndex: focusIndex,
            };
          });
        },
        mergeShopkeeperComments: (comments) => {
          set((state) => {
            const pages = state.book.pages.map((page) => ({
              ...page,
              paragraphs: page.paragraphs.map((paragraph) => {
                if (!(paragraph.id in comments)) return paragraph;
                const nextComment = comments[paragraph.id]?.trim() || null;
                if (paragraph.shopkeeper_comment === nextComment) return paragraph;
                return { ...paragraph, shopkeeper_comment: nextComment };
              }),
            }));
            const nextBook: Book = { ...state.book, pages };
            return {
              book: nextBook,
              localFragments: buildLegacyFragments(nextBook),
            };
          });
        },
      };
    },
    {
      name: 'endhere_v2_storage',
      // 硬化 localStorage：私有模式 / 配额满 / 值损坏都不允许抛错，
      // 否则 zustand persist 会把异常传导到提交流程与 hydration。
      storage: createJSONStorage(() => {
        // 探针只做一次：迁移后的第一次写入要「先写探针键、读回校验、成功才切版本」。
        // 之后的普通写入直接写，避免每次 set 都双写一份大数据。
        let writeVerified = false;
        return {
          getItem: (name) => {
            try {
              const raw = window.localStorage.getItem(name);
              if (raw === null) return null;
              // 值损坏（不是 JSON）时返回 null：回退到空书，
              // 不让 JSON.parse 的异常冒到 persist 里把 hydration 打断成白屏。
              JSON.parse(raw);
              return raw;
            } catch {
              console.warn('[EndHere Storage] 本地数据无法解析，已回退为空书（原值保留在 localStorage 里）');
              return null;
            }
          },
          setItem: (name, value) => {
            try {
              if (!writeVerified) {
                // ① 先写到探针键 → ② 读回校验 → ③ 成功才写正式键（版本号在 JSON 里，随之切换）
                const probeKey = `${name}__probe`;
                window.localStorage.setItem(probeKey, value);
                const readBack = window.localStorage.getItem(probeKey);
                window.localStorage.removeItem(probeKey);
                if (readBack !== value) {
                  // 校验不通过＝新结构没真正落盘。此时不动正式键，旧数据与旧版本原样保留，
                  // 下次打开会重新尝试迁移。
                  console.warn('[EndHere Storage] 迁移写入校验失败，已放弃本次写入（数据保持原样）');
                  return;
                }
                writeVerified = true;
              }
              window.localStorage.setItem(name, value);
            } catch (e) {
              console.warn('[EndHere Storage] 写入失败（容量已满或存储被禁用）:', e);
            }
          },
          removeItem: (name) => {
            try {
              window.localStorage.removeItem(name);
            } catch {
              // 忽略：移除失败不影响内存态
            }
          },
        };
      }),
      // v6（P1）：只加可选字段（reveal / declared_at），所以老书必须原地保留。
      // 旧实现「所有用户都以全新空书起手」会把所有人的书清空——那是不可接受的。
      version: 6,
      migrate: (persistedState: unknown, fromVersion: number) => {
        const state = (persistedState || {}) as PersistedBookState;
        const ownerId = typeof state.ownerId === 'string' && state.ownerId ? state.ownerId : createOwnerId();

        // A. 结构兼容 → 原地保留，一页都不动
        if (isCompatibleBook(state.book)) {
          const pages = state.book.pages;
          const rawIndex = Number(state.currentPageIndex);
          const currentPageIndex = Number.isFinite(rawIndex)
            ? Math.max(0, Math.min(Math.trunc(rawIndex), pages.length - 1))
            : 0;
          console.info(
            `[EndHere Storage] 结构兼容，原地保留：v${fromVersion} → v6，${pages.length} 页未动`,
          );
          return {
            ...state,
            ownerId,
            book: {
              ...state.book,
              id: typeof state.book.id === 'string' && state.book.id ? state.book.id : `book_${crypto.randomUUID()}`,
              owner_id:
                typeof state.book.owner_id === 'string' && state.book.owner_id
                  ? state.book.owner_id
                  : ownerId,
              pages,
            },
            currentPageIndex,
            localFragments: [],
            legacyArchive: Array.isArray(state.legacyArchive) ? state.legacyArchive : [],
            pendingTitleTask: null,
          };
        }

        // B. 只有真正的旧格式（V4 及以前 / 只有 localFragments）才走归档重建
        return migrateLegacyState(state, ownerId);
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('[EndHere Storage] 恢复失败，已回退到初始空书:', error);
        }
        // 恢复成功路径：直接用 state 上的 action 标记完成。
        // 注意：绝不能在回调里引用模块级 useFragmentStore（zustand v5 会同步调用此回调，
        // 此时 const 尚未初始化，会触发 TDZ ReferenceError，导致 hydration 永久卡死）。
        if (state) {
          state.setHasHydrated(true);
          state.ensureTrailingBlankPage();
          return;
        }
        // 恢复失败兜底：state 为 undefined 时，推迟到模块初始化完成后再标记 hydration，
        // 否则所有以 hasHydrated 做门控的页面会永久渲染空壳（白屏）。
        const finish = () => useFragmentStore.setState({ _hasHydrated: true });
        if (typeof queueMicrotask === 'function') queueMicrotask(finish);
        else Promise.resolve().then(finish);
      },
      partialize: (state) => ({
        ownerId: state.ownerId,
        book: state.book,
        legacyArchive: state.legacyArchive,
        currentPageIndex: state.currentPageIndex,
        lastOpenedAt: state.lastOpenedAt,
        lastSubmitTime: state.lastSubmitTime,
        mirrorViewedAt: state.mirrorViewedAt,
        personaPreferences: state.personaPreferences,
      }),
    }
  )
);

async function syncFragmentToCloud(fragment: Fragment) {
  if (fragment.visibility === 'private') return;

  try {
    const { error } = await supabase.from('fragments').insert([fragment]);
    if (error) {
      console.error('[Fragment Sync] Cloud insert failed:', error);
    }
  } catch (err) {
    console.error('[Fragment Sync] Network error:', err);
  }
}

export async function getFeaturedExhibitPool(): Promise<Fragment[]> {
  try {
    const { data, error } = await supabase
      .from('fragments')
      .select('*')
      .eq('visibility', 'public')
      .eq('is_featured', true)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data && data.length > 0) {
      return data as Fragment[];
    }
  } catch (err) {
    console.error('[Featured Exhibit] Fetch error:', err);
  }

  return [];
}

export function getCurrentBookPage() {
  return useFragmentStore.getState().currentPage();
}

export function canTurnCurrentPage() {
  return useFragmentStore.getState().canTurnPage();
}

// 读取「同一设备在 BeginHere 产生的碎片」（meta.source='beginhere'），并入 mirror 分析输入。
// BH 是 EH 的真实生活碎片上游：倾诉/彩蛋/反馈/小票都已在 fragments 表（owner_id = eh_device_id）。
// 排除 egg_status='active' 的未完成彩蛋（无沉淀文本，避免污染模式识别）。
export async function fetchCloudFragmentsByOwner(ownerId: string): Promise<Fragment[]> {
  if (!ownerId) return [];
  try {
    const { data, error } = await supabase
      .from('fragments')
      .select('*')
      .eq('owner_id', ownerId)
      .filter('meta->>source', 'eq', 'beginhere')
      .order('created_at', { ascending: false })
      .limit(80);

    if (!error && data && data.length > 0) {
      // JS 侧过滤：排除进行中的彩蛋（egg_status='active'，无沉淀文本）；
      // 不用 neq（对 NULL 会过滤掉收藏路径的碎片）
      return (data as Fragment[]).filter((r) => {
        const meta = r.meta as { beginhere?: { egg_status?: string } } | null | undefined;
        return meta?.beginhere?.egg_status !== 'active';
      });
    }
  } catch (err) {
    console.error('[Cloud Fragments] Fetch error:', err);
  }

  return [];
}
