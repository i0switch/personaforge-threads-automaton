import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔧 Auto-scheduler fix starting...');
    
    let fixedCount = 0;
    
    // 1. スタックしたprocessing状態を修復
    console.log('1. Fixing stuck processing items...');
    const { data: stuckItems, error: stuckError } = await supabase
      .from('post_queue')
      .select('id, post_id, status, updated_at')
      .eq('status', 'processing')
      .lt('updated_at', new Date(Date.now() - 10 * 60 * 1000).toISOString()); // 10分以上前

    if (stuckError) {
      console.error('Error fetching stuck items:', stuckError);
    } else if (stuckItems && stuckItems.length > 0) {
      console.log(`Found ${stuckItems.length} stuck processing items`);
      
      for (const item of stuckItems) {
        const { error: updateError } = await supabase
          .from('post_queue')
          .update({ 
            status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id);
          
        if (!updateError) {
          fixedCount++;
          console.log(`✅ Fixed stuck item: ${item.id}`);
        } else {
          console.error(`❌ Failed to fix item ${item.id}:`, updateError);
        }
      }
    }

    // 2. 重複エントリの検出と削除
    console.log('2. Finding and removing duplicates...');
    const { data: duplicates, error: dupError } = await supabase
      .from('post_queue')
      .select('post_id, status, id, created_at')
      .order('post_id')
      .order('created_at', { ascending: true });

    if (dupError) {
      console.error('Error fetching duplicates:', dupError);
    } else if (duplicates) {
      const duplicateGroups = new Map<string, any[]>();
      
      // Group by post_id + status
      duplicates.forEach(item => {
        const key = `${item.post_id}_${item.status}`;
        if (!duplicateGroups.has(key)) {
          duplicateGroups.set(key, []);
        }
        duplicateGroups.get(key)!.push(item);
      });

      // Find actual duplicates
      for (const [key, items] of duplicateGroups) {
        if (items.length > 1) {
          console.log(`Found ${items.length} duplicates for ${key}`);
          
          // Keep the first (oldest) item, delete the rest
          const toDelete = items.slice(1);
          
          for (const item of toDelete) {
            const { error: deleteError } = await supabase
              .from('post_queue')
              .delete()
              .eq('id', item.id);
              
            if (!deleteError) {
              fixedCount++;
              console.log(`✅ Deleted duplicate: ${item.id}`);
            } else {
              console.error(`❌ Failed to delete duplicate ${item.id}:`, deleteError);
            }
          }
        }
      }
    }

    // 3. 孤立したキューエントリの削除 (先にpost_idsを取得)
    console.log('3. Cleaning orphaned queue entries...');
    const { data: allPosts, error: postsError } = await supabase
      .from('posts')
      .select('id');
      
    if (postsError) {
      console.error('Error fetching posts:', postsError);
    } else {
      const validPostIds = new Set(allPosts?.map(p => p.id) || []);
      
      const { data: queueItems, error: queueItemsError } = await supabase
        .from('post_queue')
        .select('id, post_id');
        
      if (queueItemsError) {
        console.error('Error fetching queue items:', queueItemsError);
      } else if (queueItems) {
        const orphanedItems = queueItems.filter(item => !validPostIds.has(item.post_id));
        
        console.log(`Found ${orphanedItems.length} orphaned queue items`);
        
        for (const item of orphanedItems) {
          const { error: deleteError } = await supabase
            .from('post_queue')
            .delete()
            .eq('id', item.id);
            
          if (!deleteError) {
            fixedCount++;
            console.log(`✅ Deleted orphaned item: ${item.id}`);
          } else {
            console.error(`❌ Failed to delete orphaned item ${item.id}:`, deleteError);
          }
        }
      }
    }

    // 4. 完了済み投稿のキューエントリをクリーンアップ
    console.log('4. Cleaning completed posts queue entries...');
    const { data: publishedPosts, error: publishedError } = await supabase
      .from('posts')
      .select('id')
      .eq('status', 'published');

    if (publishedError) {
      console.error('Error finding published posts:', publishedError);
    } else if (publishedPosts) {
      const publishedPostIds = new Set(publishedPosts.map(p => p.id));
      
      const { data: queueItemsForUpdate, error: queueUpdateError } = await supabase
        .from('post_queue')
        .select('id, post_id')
        .not('status', 'eq', 'completed');
        
      if (queueUpdateError) {
        console.error('Error fetching queue items for update:', queueUpdateError);
      } else if (queueItemsForUpdate) {
        const itemsToComplete = queueItemsForUpdate.filter(item => publishedPostIds.has(item.post_id));
        
        console.log(`Found ${itemsToComplete.length} queue items for completed posts`);
        
        for (const item of itemsToComplete) {
          const { error: updateError } = await supabase
            .from('post_queue')
            .update({ 
              status: 'completed',
              updated_at: new Date().toISOString()
            })
            .eq('id', item.id);
            
          if (!updateError) {
            fixedCount++;
            console.log(`✅ Marked as completed: ${item.id}`);
          } else {
            console.error(`❌ Failed to mark as completed ${item.id}:`, updateError);
          }
        }
      }
    }

    console.log(`🔧 Auto-scheduler fix completed. Total fixes: ${fixedCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Fixed ${fixedCount} issues`,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Fix function error:', error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
