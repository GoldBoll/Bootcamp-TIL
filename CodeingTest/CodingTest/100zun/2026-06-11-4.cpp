// 백준 2644 - 촌수계산
// https://www.acmicpc.net/problem/2644

// 문제 설명
// 부모-자식 관계(1촌)가 주어질 때 두 사람의 촌수를 구하라
// 연결되지 않으면 -1 출력

// 접근
// - 양방향 인접 리스트 구성
// - s에서 DFS, e 도달 시 depth를 ret에 저장 후 true 반환(조기 종료)

#include <iostream>
#include <vector>
using namespace std;
#define endl '\n'

int n, m;
int s, e;
vector<int> v[104];
bool visited[104];

bool dfs(int here, int depth, int& ret)
{
    visited[here] = true;
    if (here == e)
    {
        ret = depth;
        return true;
    }
    for (int i : v[here])
        if (!visited[i])
            if (dfs(i, depth + 1, ret))
                return true;
    return false;
}

int main()
{
    ios_base::sync_with_stdio(false);
    cin.tie(nullptr);

    cin >> n >> s >> e >> m;
    while (m--)
    {
        int a, b;
        cin >> a >> b;
        v[a].push_back(b);
        v[b].push_back(a);
    }

    int ret = -1;
    dfs(s, 0, ret);
    cout << ret << endl;
    return 0;
}
