// 백준 1987 - 알파벳 (Gold 4) — 튜터님 스타일 백트래킹 (visited 배열 + int 반환)
// https://www.acmicpc.net/problem/1987
// (같은 문제 비트마스킹 버전: 2026-07-09-1.cpp)

// 문제 설명
// R x C 보드의 각 칸에 대문자 알파벳. (1,1)에서 출발해 상하좌우로 이동하는데
// 지금까지 지나온 칸의 알파벳과 같은 알파벳 칸은 밟을 수 없다.
// 말이 지날 수 있는 최대 칸 수를 출력 (시작 칸 포함).

// 제약 조건
// 1 <= R, C <= 20, 알파벳은 대문자 26종

// 예제
// 입력              출력
// 2 4 / CAAB ADCB      3
// 3 6 / HFDFFB ...     6
// 5 5 / IEFCJ ...     10

// 접근 — int 반환 백트래킹 (visited[26] + int dfs, 전역 ans 없음)
// 비트마스크 대신 int visited[26]로 지나온 알파벳을 표시.
// dfs(y, x) = (y,x)에서 시작해 지날 수 있는 최대 칸 수를 반환 (튜터 스타일 int 반환).
//   네 방향 중 범위 안 + 알파벳 미사용 칸으로 이동, visited=1 켜고 재귀,
//   리턴 후 visited=0으로 되돌린다(백트래킹 do/undo).
//   자식 방향들의 최댓값 ret에 현재 칸(+1)을 더해 반환.

#include <iostream>
#include <string>
#include <algorithm>
using namespace std;
#define endl '\n'

int n, m;
string b[24];
int visited[26];
int dy[] = { -1, 1, 0, 0 };
int dx[] = { 0, 0, -1, 1 };

int dfs(int y, int x)
{
    int ret = 0;
    for (int i = 0; i < 4; i++)
    {
        int ny = y + dy[i];
        int nx = x + dx[i];
        if (ny < 0 || ny >= n || nx < 0 || nx >= m) continue;

        int c = b[ny][nx] - 'A';
        if (visited[c]) continue;

        visited[c] = 1;
        ret = max(ret, dfs(ny, nx));
        visited[c] = 0;
    }
    return ret + 1;
}

int main()
{
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    cout.tie(NULL);

    cin >> n >> m;
    for (int i = 0; i < n; i++)
        cin >> b[i];

    visited[b[0][0] - 'A'] = 1;
    cout << dfs(0, 0) << endl;
}

// 코드 주석
// int dfs(int y, int x)          (y,x)에서 지날 수 있는 최대 칸 수를 반환 (전역 ans 안 씀)
// int c = b[ny][nx] - 'A';       다음 칸 알파벳을 0~25 인덱스로 (c - 'A' 변환)
// if (visited[c]) continue;      이미 지나온 알파벳이면 스킵
// visited[c] = 1; ret = max(ret, dfs(ny,nx)); visited[c] = 0;   켜고 재귀, 리턴 후 꺼서 복원
// return ret + 1;                자식 방향 최댓값 + 현재 칸(1)
// visited[b[0][0]-'A'] = 1;      시작 칸 알파벳 표시 후 cout << dfs(0,0)
