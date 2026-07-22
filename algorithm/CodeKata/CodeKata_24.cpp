//https://school.programmers.co.kr/learn/courses/30/lessons/172928

#include <string>
#include <vector>

using namespace std;

vector<int> solution(vector<string> park, vector<string> routes) {
    int n = park.size(), m = park[0].size();
    int r = 0, c = 0;

    // 시작 지점 'S' 찾기
    for (int i = 0; i < n; i++)
        for (int j = 0; j < m; j++)
            if (park[i][j] == 'S') { r = i; c = j; }

    for (string& route : routes) {
        char op = route[0];
        int d = route[2] - '0';     // 이동할 칸 수
        int dr = 0, dc = 0;
        if (op == 'N') dr = -1;
        else if (op == 'S') dr = 1;
        else if (op == 'W') dc = -1;
        else dc = 1;                // 'E'

        // 한 칸씩 전진하며 공원 이탈/장애물을 검사 — 하나라도 걸리면 명령 전체 무시
        int nr = r, nc = c;
        bool ok = true;
        for (int k = 0; k < d; k++) {
            nr += dr; nc += dc;
            if (nr < 0 || nr >= n || nc < 0 || nc >= m || park[nr][nc] == 'X') {
                ok = false;
                break;
            }
        }
        if (ok) { r = nr; c = nc; }  // 전 구간 통과한 명령만 실제 이동
    }

    return {r, c};
}
