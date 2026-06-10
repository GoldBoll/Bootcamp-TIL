//https://school.programmers.co.kr/learn/courses/30/lessons/161990

#include <string>
#include <vector>

using namespace std;

vector<int> solution(vector<string> wallpaper) {
    int n = wallpaper.size(), m = wallpaper[0].size();
    int r1 = n, c1 = m;     // 파일이 있는 최소 행·열
    int r2 = -1, c2 = -1;   // 파일이 있는 최대 행·열

    for (int i = 0; i < n; i++)
        for (int j = 0; j < m; j++)
            if (wallpaper[i][j] == '#') {
                if (i < r1) r1 = i;
                if (j < c1) c1 = j;
                if (i > r2) r2 = i;
                if (j > c2) c2 = j;
            }

    // 시작점은 칸의 왼쪽 위 격자점, 끝점은 칸의 오른쪽 아래 격자점이라 +1
    return {r1, c1, r2 + 1, c2 + 1};
}
