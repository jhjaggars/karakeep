import { NextRequest } from "next/server";
import { api, createContextFromRequest } from "@/server/api/client";
import { List } from "@karakeep/trpc/models/lists";
import { Bookmark } from "@karakeep/trpc/models/bookmarks";
import type { ZBookmark } from "@karakeep/shared/types/bookmarks";

export const dynamic = "force-dynamic";

function escapeCSVField(field: any): string {
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
    row.map(escapeCSVField).join(",")
  );

  return csvRows.join("\n");
}

export async function GET(
  request: NextRequest,
  { params }: { params: { listId: string } }
) {
  const ctx = await createContextFromRequest(request);
  if (!ctx.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Load list (this validates permissions automatically)
    const list = await List.fromId(ctx, params.listId);

    // Get all bookmark IDs in the list
    const bookmarkIds = await list.getBookmarkIds();

    // If list is empty, return CSV with headers only
    if (bookmarkIds.length === 0) {
      const csv = generateCSV([]);
      const sanitizedName = list.name.replace(/[/\\:*?"<>|]/g, "-");
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="list-${sanitizedName}-${new Date().toISOString()}.csv"`,
        },
      });
    }

    // Load all bookmarks with full content
    const { bookmarks } = await Bookmark.loadMulti(ctx, {
      ids: bookmarkIds,
      includeContent: true,
      limit: bookmarkIds.length,
    });

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
    return Response.json(
      { error: "Failed to export list" },
      { status: 500 }
    );
  }
}
