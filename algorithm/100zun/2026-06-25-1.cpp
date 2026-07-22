// 백준 ____ - (문제명)
// https://www.acmicpc.net/problem/____

// 문제 설명
// (지문 받으면 채우기)

// 제약 조건
// (받으면 채우기)

// 예제
// 입력            출력

// 접근
// (받으면 채우기)

#include <iostream>
#include <string>
#include <map>
#include <vector>
#include <queue>
using namespace std;
#define endl '\n'


//n 정점 m 간선의 갯수
int n ,m;

vector<int> v[104];

//bool 값을 int 로 활용하는게 좋다
int visited[104];

int main()
{
    // cin >> t; while (t--) { ... }

    cin>>n>>m;
    for(int i=0; i<m; i++)
    {
        int A,B;

        cin >> A>> B;

        v[A].push_back(B);
        v[B].push_back(A);

    }


    //dFS 그래프


    //3개 세팅 , pop

    //요 세트 는 그냥 암기 
    queue<int>q;
    q.push(1);
    visited[1] = true;

    while(q.size())
    {
        int here = q.front();
        q.pop();

        for(int i : v[here])
        {
            if(!visited[i])
            {
                q.push(i);
                visited[i] = true;
            }
        }
    }

    return 0;
}


//입력을 받았다는 가정하에  bFS

int a[104][104];

int visited[104][104];

 

int dy[4] = { -1,0,1,0 };

int dx[4] = { 0,1,0,-1 };

 

//int n, m;

 

void bfs(int sy, int sx)

{

	queue<pair<int, int>> q;

	visited[sy][sx] = true;

	q.push({ sy,sx });

 

	while (q.size())

	{

		int y = q.front().first;

		int x = q.front().second;

		q.pop();

 

		for (int i = 0; i < 4; i++)

		{

			int ny = y + dy[i];

			int nx = x + dx[i];

 

			if (ny < 0 || nx < 0 || ny >= n || nx >= m) continue;

			if (visited[ny][nx] || a[ny][nx] == 0) continue;

 

			q.push({ ny, nx });

			visited[ny][nx] = true;

		}

	}

}

//그래프 건너띄고 행렬 