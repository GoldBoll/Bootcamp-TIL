#include "archer.h"
#include "monster.h"
Archer::Archer(string nickname) : Player(nickname) {
    job_name = "궁수";
    HP = 100; MP = 80; power = 18; defence = 10; accuracy = 25; speed = 15;
}
void Archer::attack() {
    cout << "* " << nickname << "이(가) 활로 공격합니다!" << endl;
}
void Archer::attack(Monster* monster) {
    int damage = power - monster->getDefence();
    if (damage <= 0) damage = 1;
    int single = damage / 3;
    if (single <= 0) single = 1;
    for (int i = 0; i < 3; i++)
        cout << "* " << monster->getName() << "에게 활로 " << single << "의 피해를 입혔다!" << endl;
    monster->setHP(monster->getHP() - single * 3);
    if (monster->getHP() <= 0)
        cout << "* " << monster->getName() << "을(를) 물리쳤습니다! 승리!" << endl;
    else
        cout << monster->getName() << "의 남은 HP: " << monster->getHP() << endl;
}
