// 백준 1987 - 알파벳 (Gold 4) — [버전 A] 비트마스킹
// https://www.acmicpc.net/problem/1987
// (같은 문제 백트래킹(visited 배열) 버전: 2026-07-09-1-bt.cpp)

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

// 접근 — 비트마스킹 + DFS 백트래킹
// "지나온 알파벳 집합"을 bool[26] 대신 int 하나의 26비트 마스크로 든다.
//   비트 i = 알파벳 ('A'+i) 사용 중  (c - 'A' 인덱스 변환)
//   방문 검사: mask & (1 << bit), 방문 표시: mask | (1 << bit)
// 마스크를 재귀 인자(값 복사)로 넘기면 리턴 시 자동 복원 — 되돌리기 코드가 없다.
// 경로 길이는 최대 26 (알파벳 종류 수)이라 깊이가 저절로 잘린다.

#include <iostream>
#include <string>
using namespace std;
#define endl '\n'

int n, m, ans;
string b[24];
int dy[] = { -1, 1, 0, 0 };
int dx[] = { 0, 0, -1, 1 };

void dfs(int y, int x, int mask, int cnt)
{
    if (cnt > ans) ans = cnt;

    for (int i = 0; i < 4; i++)
    {
        int ny = y + dy[i];
        int nx = x + dx[i];
        if (ny < 0 || ny >= n || nx < 0 || nx >= m) continue;

        int bit = 1 << (b[ny][nx] - 'A');
        if (mask & bit) continue;
        dfs(ny, nx, mask | bit, cnt + 1);
    }
}

int main()
{
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    cout.tie(NULL);

    cin >> n >> m;
    for (int i = 0; i < n; i++)
        cin >> b[i];

    dfs(0, 0, 1 << (b[0][0] - 'A'), 1);
    cout << ans << endl;
}

// 코드 주석
// int n, m;                             n = 행(R), m = 열(C) — 강사 컨벤션대로 n·m 사용
// int bit = 1 << (b[ny][nx] - 'A');     새 칸 알파벳의 비트 (c - 'A' 인덱스 변환)
// if (mask & bit) continue;             이미 지나온 알파벳이면 스킵
// dfs(ny, nx, mask | bit, cnt + 1);     마스크를 값으로 전달 → 리턴하면 자동 복원 (백트래킹)
// dfs(0, 0, 1 << (b[0][0]-'A'), 1);     시작 칸 알파벳을 켠 채 출발, 칸 수는 1부터
