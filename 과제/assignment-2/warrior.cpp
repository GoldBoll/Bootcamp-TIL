#include "warrior.h"
#include "monster.h"

Warrior::Warrior(string nickname) : Player(nickname) {
    job_name = "전사";
    HP = 150; MP = 50;
    power = 20; defence = 15;
    accuracy = 8; speed = 7;
}

void Warrior::attack() {
    cout << "* " << nickname << "(이)가 검을 휘두릅니다!" << endl;
}

void Warrior::attack(Monster* monster) {
    int damage = power - monster->getDefence();
    if (damage <= 0) damage = 1;

    cout << "* " << monster->getName() << "에게 검으로 " << damage << "의 피해를 입혔다!" << endl;
    monster->setHP(monster->getHP() - damage);

    if (monster->getHP() <= 0)
        cout << "* " << monster->getName() << "을(를) 물리쳤습니다! 승리!" << endl;
    else
        cout << monster->getName() << "의 남은 HP: " << monster->getHP() << endl;
}
