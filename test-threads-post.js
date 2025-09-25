// Manual test for threads-post function
const testPost = async () => {
  try {
    const response = await fetch('https://tqcgbsnoiarnawnppwia.supabase.co/functions/v1/threads-post', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxY2dic25vaWFybmF3bnBwd2lhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTkxNTE4MSwiZXhwIjoyMDY1NDkxMTgxfQ.WQJTEWyaLFUo4TBDCWwfJXJgOBmXVUoE_yNLFKP_k4g'
      },
      body: JSON.stringify({
        postId: 'ad922075-b97c-4f65-94dc-81615e9f20c0', // 手動でpost IDを指定
        userId: '3ca14017-07ca-423f-bce8-e73c75b8c9b4'   // user IDを指定
      })
    });
    
    const result = await response.json();
    console.log('Response:', result);
    return result;
  } catch (error) {
    console.error('Error:', error);
    return error;
  }
};

testPost();