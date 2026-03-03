// Manual test for threads-post function
const testPost = async () => {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const postId = process.env.THREADS_TEST_POST_ID;
    const userId = process.env.THREADS_TEST_USER_ID;

    if (!serviceRoleKey || !postId || !userId) {
      throw new Error('Missing required env vars: SUPABASE_SERVICE_ROLE_KEY, THREADS_TEST_POST_ID, THREADS_TEST_USER_ID');
    }

    const response = await fetch('https://tqcgbsnoiarnawnppwia.supabase.co/functions/v1/threads-post', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`
      },
      body: JSON.stringify({
        postId,
        userId
      })
    });
    
    const result = await response.json();
    console.log('Response:', result);
    return result;
  } catch (error) {
    console.error('Error:', error);
    process.exitCode = 1;
    return error;
  }
};

testPost();