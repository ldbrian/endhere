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
};

export type Book = {
  id: string;
  owner_id: string;
  pages: BookPage[];
};

// ── Legacy Archive ──────────────────────────────────────────
// V4 以前的旧书页，移入陈列，只读，不再参与主书翻页流程。
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
  adjustPersonaPreference: (persona: string, delta: 1 | -1) => void;
  currentPage: () => BookPage;
  canTurnPage: () => boolean;
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
      storage: createJSONStorage(() => localStorage),
      version: 4,
      migrate: (persistedState: unknown) => {
        const state = (persistedState || {}) as Partial<BookState> & { localFragments?: Fragment[]; ownerId?: string; book?: Book; currentPageIndex?: number; legacyArchive?: LegacyPage[] };
        const ownerId = state.ownerId || createOwnerId();

        // 先重建出旧 book（兼容两种历史格式：已有 book.pages 的 V3，和只有 localFragments 的更早版本）
        let oldBook: Book | null = null;
        if (state.book?.pages?.length) {
          oldBook = state.book;
        } else if (Array.isArray(state.localFragments) && state.localFragments.length > 0) {
          const legacyFragments = [...state.localFragments].sort((a, b) => a.created_at.localeCompare(b.created_at));
          let page: BookPage = createEmptyPage(0);
          const pages: BookPage[] = [];
          for (const item of legacyFragments) {
            const paragraph: Paragraph = {
              id: item.id,
              text: item.original_content,
              trace: item.narration_content,
              timestamp: item.created_at,
              persona: item.meta.ai_persona,
              artifact: item.meta.artifact,
              consent_level: item.meta.consent_level,
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

        // 把有内容的旧页转成陈列页（只读），尾部空白页丢弃
        const legacyArchive: LegacyPage[] = Array.isArray(state.legacyArchive) ? [...state.legacyArchive] : [];
        if (oldBook) {
          for (const page of oldBook.pages) {
            if (page.paragraphs.length > 0) {
              legacyArchive.push(bookPageToLegacy(page));
            }
          }
        }

        // 所有用户（新老）都以一本全新的空书起手
        const book = createInitialBook(ownerId);

        return {
          ...state,
          ownerId,
          book,
          currentPageIndex: 0,
          localFragments: [],
          legacyArchive,
          pendingTitleTask: null,
        };
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
        if (state) state.ensureTrailingBlankPage();
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
