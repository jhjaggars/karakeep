import { NextRequest } from "next/server";
import { api, createContextFromRequest } from "@/server/api/client";

import type { ZBookmark } from "@karakeep/shared/types/bookmarks";
import { MAX_NUM_BOOKMARKS_PER_PAGE } from "@karakeep/shared/types/bookmarks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeCSVField(field: unknown): string {
  if (field === null || field === undefined) return "";
  const str = String(field);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function generateCSV(bookmarks: ZBookmark[]): string {
  const headers = [
    "id",
    "title",
    "url",
    "description",
    "note",
    "summary",
    "tags",
    "author",
    "publisher",
    "datePublished",
    "dateModified",
    "createdAt",
    "modifiedAt",
    "archived",
    "favourited",
    "type",
    "source",
    "crawlStatus",
    "favicon",
    "imageUrl",
  ];

  const rows = bookmarks.map((bookmark) => {
    // Extract fields based on content type
    let url = "";
    let description = "";
    let author = "";
    let publisher = "";
    let datePublished = "";
    let dateModified = "";
    let crawlStatus = "";
    let favicon = "";
    let imageUrl = "";

    if (bookmark.content.type === "link") {
      url = bookmark.content.url || "";
      description = bookmark.content.description || "";
      author = bookmark.content.author || "";
      publisher = bookmark.content.publisher || "";
      datePublished = bookmark.content.datePublished
        ? bookmark.content.datePublished.toISOString()
        : "";
      dateModified = bookmark.content.dateModified
        ? bookmark.content.dateModified.toISOString()
        : "";
      favicon = bookmark.content.favicon || "";
      imageUrl = bookmark.content.imageUrl || "";
    }

    // Format tags with pipe separator to avoid CSV confusion
    const tags = bookmark.tags.map((t) => t.name).join("|");

    return [
      bookmark.id,
      bookmark.title || "",
      url,
      description,
      bookmark.note || "",
      bookmark.summary || "",
      tags,
      author,
      publisher,
      datePublished,
      dateModified,
      bookmark.createdAt.toISOString(),
      bookmark.modifiedAt ? bookmark.modifiedAt.toISOString() : "",
      bookmark.archived.toString(),
      bookmark.favourited.toString(),
      bookmark.content.type,
      bookmark.source || "",
      crawlStatus,
      favicon,
      imageUrl,
    ];
  });

  const csvRows = [headers, ...rows].map((row) =>
    row.map(escapeCSVField).join(","),
  );

  return csvRows.join("\n");
}

export async function GET(
  request: NextRequest,
  { params }: { params: { listId: string } },
) {
  const ctx = await createContextFromRequest(request);
  if (!ctx.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get list details using tRPC
    const list = await api.lists.get({ listId: params.listId });

    // Get all bookmarks in the list using pagination
    const req = {
      listId: params.listId,
      limit: MAX_NUM_BOOKMARKS_PER_PAGE,
      useCursorV2: true,
      includeContent: true,
    };

    let resp = await api.bookmarks.getBookmarks(req);
    let bookmarks = resp.bookmarks;

    while (resp.nextCursor) {
      resp = await api.bookmarks.getBookmarks({
        ...req,
        cursor: resp.nextCursor,
      });
      bookmarks = [...bookmarks, ...resp.bookmarks];
    }

    // Generate CSV
    const csv = generateCSV(bookmarks);

    // Return response with sanitized filename
    const sanitizedName = list.name.replace(/[/\\:*?"<>|]/g, "-");
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="list-${sanitizedName}-${new Date().toISOString()}.csv"`,
      },
    });
  } catch (error) {
    console.error("Error exporting list:", error);
    return Response.json({ error: "Failed to export list" }, { status: 500 });
  }
}
