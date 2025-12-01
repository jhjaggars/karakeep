"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Download } from "lucide-react";
import { useTranslation } from "@/lib/i18n/client";
import { toast } from "sonner";

import { ZBookmarkList } from "@karakeep/shared/types/lists";

export default function ExportListLink({ list }: { list: ZBookmarkList }) {
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch(`/api/lists/${list.id}/export?format=csv`);
      if (!response.ok) {
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `list-${list.name}-${new Date().toISOString()}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success(t("lists.export.success"));
    } catch (error) {
      console.error("Export error:", error);
      toast.error(t("lists.export.error"));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-sm font-medium">
          {t("lists.export.title")}
        </Label>
        <p className="text-xs text-muted-foreground">
          {t("lists.export.description")}
        </p>
      </div>
      <Button
        onClick={handleExport}
        disabled={isExporting}
        variant="outline"
        className="w-full"
      >
        {isExporting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("lists.export.exporting")}
          </>
        ) : (
          <>
            <Download className="mr-2 h-4 w-4" />
            {t("lists.export.download_csv")}
          </>
        )}
      </Button>
    </div>
  );
}
