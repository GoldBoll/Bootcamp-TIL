//https://school.programmers.co.kr/learn/courses/30/lessons/12949

#include <vector>

using namespace std;

vector<vector<int>> solution(vector<vector<int>> arr1, vector<vector<int>> arr2) {
    int r = arr1.size(), c = arr2[0].size(), m = arr2.size();
    vector<vector<int>> answer(r, vector<int>(c, 0));

    for (int i = 0; i < r; i++)
        for (int k = 0; k < m; k++)          // i-k-j 순서: arr2를 행 방향으로 읽어 캐시 친화적
            for (int j = 0; j < c; j++)
                answer[i][j] += arr1[i][k] * arr2[k][j];
    return answer;
}
