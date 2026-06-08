//https://school.programmers.co.kr/learn/courses/30/lessons/133502

#include <string>
#include <vector>

using namespace std;

int solution(vector<int> ingredient) {
    int answer = 0;

    vector<int> st;                 // 쌓이는 재료 스택
    for (int x : ingredient) {
        st.push_back(x);
        int n = st.size();
        // 위 4개가 아래->위로 빵(1)-야채(2)-고기(3)-빵(1)이면 포장
        if (n >= 4 && st[n - 1] == 1 && st[n - 2] == 3 && st[n - 3] == 2 && st[n - 4] == 1) {
            st.resize(n - 4);       // 완성된 4개 제거
            answer++;
        }
    }

    return answer;
}
