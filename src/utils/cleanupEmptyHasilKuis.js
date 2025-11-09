import { supabaseAdmin } from "../config/supabaseAdmin.js";

/**
 * Cleanup script untuk menghapus hasil_kuis_siswa yang kosong
 * (tidak ada detail_jawaban_siswa)
 *
 * Run dengan: node src/utils/cleanupEmptyHasilKuis.js
 */

async function cleanupEmptyHasilKuis() {
  try {
    console.log("🧹 Starting cleanup of empty hasil_kuis_siswa...");

    // Get all hasil_kuis_siswa
    const { data: allHasil, error: fetchError } = await supabaseAdmin
      .from("hasil_kuis_siswa")
      .select("id, kuis_id, siswa_id, selesai, created_at")
      .order("created_at", { ascending: false });

    if (fetchError) {
      console.error("❌ Error fetching hasil_kuis_siswa:", fetchError);
      return;
    }

    console.log(`📊 Total hasil_kuis_siswa entries: ${allHasil.length}`);

    let deletedCount = 0;

    // Check each entry
    for (const hasil of allHasil) {
      // Get detail_jawaban_siswa for this hasil
      const { data: details, error: detailError } = await supabaseAdmin
        .from("detail_jawaban_siswa")
        .select("id")
        .eq("hasil_kuis_id", hasil.id);

      if (detailError) {
        console.error(
          `❌ Error checking details for ${hasil.id}:`,
          detailError
        );
        continue;
      }

      // If no details and not finished, delete it
      if (details.length === 0 && !hasil.selesai) {
        console.log(
          `🗑️  Deleting empty entry: ${hasil.id} (created: ${hasil.created_at})`
        );

        const { error: deleteError } = await supabaseAdmin
          .from("hasil_kuis_siswa")
          .delete()
          .eq("id", hasil.id);

        if (deleteError) {
          console.error(`❌ Error deleting ${hasil.id}:`, deleteError);
        } else {
          deletedCount++;
        }
      }
    }

    console.log(`✅ Cleanup completed! Deleted ${deletedCount} empty entries.`);
    console.log(`📊 Remaining entries: ${allHasil.length - deletedCount}`);
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
  }
}

// Run the cleanup
cleanupEmptyHasilKuis();
