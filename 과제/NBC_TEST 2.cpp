//1

// #include <iostream>
// #include <string>
// using namespace std;

// // s가 팰린드롬이면 1, 아니면 0 반환
// int solution(const string& s) {
//     // TODO 여기에 코드를 작성하세요
//     if(s.empty()) return 0;

//     if(s.size() == 1) return 1;

//     int left = 0;
//     int right = (int)s.size() -1;

//     while(left < right)
//     {
//         if(s[left] != s[right]) return 0;
//         left++;
//         right--;
//     }
//     return 1;
// }

// int main() {
//     cout << solution("racecar") << endl;  // 1
//     cout << solution("hello")   << endl;  // 0
//     cout << solution("abcba")   << endl;  // 1
//     cout << solution("")        << endl;  // 0
//     cout << solution("a")       << endl;  // 1
//     return 0;
// }


//2
// #include <iostream>
// #include <vector>
// #include <queue>
// using namespace std;

// /*
//  * grid: N×M 격자 (1=땅, 0=바다)
//  * 반환: 섬의 개수
//  */

// int rowDir[] = {-1,1,0,0};
// int colDir[]= {0,0,-1,1};

// int solution(vector<vector<int>>& grid) {
//     // TODO 여기에 코드를 작성하세요

//     if(grid.empty()) return 0;
//     int row = grid.size();
//     int col = grid[0].size();
//     int count = 0;

//     for(int r = 0; r < row; r++)
//     {
//         for(int c = 0; c < col; c++)
//         {
//             if(grid[r][c] == 1)
//             {
//                 count++;
//                 queue<pair<int,int>> q;
//                 q.push({r,c});
//                 grid[r][c] = 0;
//                 while(!q.empty())
//                 {
//                     auto [r,c] = q.front();
//                     q.pop();

//                     for(int dir = 0; dir < 4; dir++)
//                     {
//                         int nextRow = r + rowDir[dir];
//                         int nextCol = c + colDir[dir];

//                         if(nextRow < 0 || nextRow >= row) continue;
//                         if(nextCol < 0 || nextCol >= col) continue;
//                         if(grid[nextRow][nextCol] == 0) continue;

//                         grid[nextRow][nextCol] = 0;
//                         q.push({nextRow,nextCol});
//                     }
//                 }
                
//             }
//         }
//     }

//     return count;
// }

// int main() {
//     vector<vector<int>> g1 = {
//         {1, 1, 0, 0},
//         {1, 0, 0, 1},
//         {0, 0, 1, 1}
//     };
//     cout << solution(g1) << endl; // 2

//     vector<vector<int>> g2 = {
//         {1, 1, 1},
//         {1, 1, 1}
//     };
//     cout << solution(g2) << endl; // 1

//     vector<vector<int>> g3 = {
//         {0, 0},
//         {0, 0}
//     };
//     cout << solution(g3) << endl; // 0
//     return 0;
// }

//3

// ## 3. 반사 벡터 계산 (논술) (6점, 부분점수 있음)

// <aside>
// 📌

// 당신은 **1인칭 슈팅 게임의 총알 반사 시스템**을 구현하는 개발자입니다.

// 총알이 벽면에 충돌했을 때, 물리적으로 올바른 방향으로 튕겨나가야 합니다.

// **"입사 벡터(총알 진행 방향)와 벽의 법선 벡터(normal)가 주어질 때, 반사 벡터를 어떻게 수학적으로 구할 수 있는가?"**

// - 수학적 공식을 유도하고, 게임 코드에 적용 가능한 형태로 설명할 것.
// - 내적(dot product)을 반드시 활용할 것.
// </aside>

// #include <iostream>
// using namespace std;

// struct Vector3
// {
//     float x, y, x;
// }




//4 2
//5 2
//6 1
//7 4

//8 
// 다음 코드에서 발생하는 **문제와 해결 방법**을 서술하시오.

// ```cpp
// struct Node {
//     shared_ptr<Node> next;
//     shared_ptr<Node> prev;
// };
// auto a = make_shared<Node>();
// auto b = make_shared<Node>();
// a->next = b;
// b->prev = a;
// ```

// 정답은 다음 두 가지를 반드시 포함하도록 해야 합니다.

// 1️⃣ 어떤 문제가 발생하는가 — **참조 카운트(reference count)** 관점에서 설명
 // a와 b가 서로를 참조하는 순환 참조로 인해 참조 카운트가 영원히 0이 되지 않아 메모리 누수 발생 

// 2️⃣ 어떤 스마트 포인터로 어떻게 해결하는가
//





// ### 9. 데이터 지향 설계 (DOD) (2점, 부분점수 있음)

// <aside>
// 📌

// Unreal Engine에서 수천 개의 Enemy를 **매 프레임 위치만 업데이트**하는 상황이다.

// 다음 두 설계 중 **캐시 효율이 더 높은 쪽**과 그 이유를 설명하시오.

// ```cpp
// // 설계 A: AoS (Array of Structures)
// struct Enemy { FVector pos; float hp; float speed; };
// TArray<Enemy> enemies;

// // 설계 B: SoA (Structure of Arrays)
// struct EnemyData {
//     TArray<FVector> positions;
//     TArray<float> hps;
//     TArray<float> speeds;
// };
// ```

// 정답은 다음 두 가지를 반드시 포함하도록 해야 합니다.

// 1️⃣ 어느 설계가 유리한가
//매 프레임 위치만 업데이트 하는 상황에서 SoA는 pos만 연속으로 접근하므로 캐시 효율이 높고 처리속도가 빠릅니다.
// 2️⃣ **메모리 레이아웃**과 **캐시 라인** 관점에서 이유 설명

// </aside>




