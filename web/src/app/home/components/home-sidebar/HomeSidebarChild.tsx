import styles from './HomeSidebar.module.css';

export interface ISidebarChildVO {
  id: string;
  icon: React.ReactNode;
  name: string;
  route: string;
}

export class SidebarChildVO {
  id: string;
  icon: React.ReactNode;
  name: string;
  route: string;

  constructor(props: ISidebarChildVO) {
    this.id = props.id;
    this.icon = props.icon;
    this.name = props.name;
    this.route = props.route;
  }
}

export function SidebarChild({
  icon,
  name,
  isSelected,
}: {
  icon: React.ReactNode;
  name: string;
  isSelected: boolean;
}) {
  return (
    <div
      className={`${styles.sidebarChildContainer} ${isSelected ? styles.sidebarSelected : styles.sidebarUnselected}`}
    >
      <div className={`${styles.sidebarChildIcon}`}>
        {icon}
      </div>
      <span className={`${styles.sidebarChildName}`}>
        {name}
      </span>
    </div>
  );
}
