import Head from 'next/head';
import Image from 'next/image';
import { Inter } from '@next/font/google';
import styles from '@/styles/Home.module.css';
import React, { useState, useEffect, useCallback, cloneElement, memo, useMemo, forwardRef, useRef, useLayoutEffect, MutableRefObject } from 'react';
import cn from 'classnames';
import { useSpring, animated } from '@react-spring/web';
import { queryDB } from './api/vectorRetrieval';
import { sendChat } from './api/chat';
import { Rnd } from 'react-rnd';
import debounce from 'lodash.debounce';
import { ImSpinner2 } from 'react-icons/im';
import { AiOutlineSend } from 'react-icons/ai';
import Masks from './assets/Masks.png';
import { StreamSidebar } from '../components/Sidebar';
import Tweet, { Account, Card, ContentSwitch } from '../components/Tweet';
import { VariableSizeGrid } from 'react-window';
import './App.css';
import tftTweets from '../static/sample.json'
import { left } from '@popperjs/core';
import useMeasure from 'react-use-measure';
import MessageStream from '../components/messageStream';

const inter = Inter({ subsets: ['latin'] })

const Grab = ({ isResizing }: { isResizing: any }) => {
  const [isHovered, setHovered] = useState(false);

  return (
    <div
      className="bg-gray-400/20 hover:bg-gray-300/20 absolute top-6 right-4 w-6 h-6 rounded-full cursor-grab"
    >
      <div className={cn(
        "w-3 h-3 transition-all duration-200 hover:w-5 hover:h-5 rounded-full bg-white/55 hover:bg-white/95 m-auto hover:mt-0.5 mt-1.5", )}/>
    </div>
  );
}

// Do not re-render if setSeed has changed. 
const propsAreEqual = (prevProps: any, nextProps: any): boolean => {
  return prevProps.setSeed !== nextProps.setSeed;
};

const Feed = memo(({ content, offsetLeft, sidebarTop, isResizing, setSeed,  }: { content: any, offsetLeft: any, sidebarTop: any, isResizing: any, setSeed: any, }) => {

  // accepts content and renders a grid of content in a chosen order manages their focus
  const [GUTTER, setGUTTER] = useState(22)

  const innerElementType = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ style, ...rest }, ref) => (
    <div
      ref={ref}
      style={{
        ...style,
        paddingTop: GUTTER,
        paddingRight: GUTTER,
      }}
      {...rest}
    />
  ));

  content = [{}, ...content, {}]; // add an empty object to beginnign and end of content  to allow for padding
  
  // Dynamically sizing rows
  const gridRef: MutableRefObject<VariableSizeGrid | null> = useRef(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollTo = useCallback((scrollOffset: number) => {
    scrollRef?.current?.scrollTo({ 
      left: 0, 
      top: scrollOffset,
      behavior: 'smooth',
    })
  }, []);

  const rowSizes = useRef({})
  const setRowSize = (index: number, size: number) => {
    rowSizes.current = {...rowSizes.current, [index]: size}
    gridRef?.current?.resetAfterRowIndex(index, false)
  }

  const rowFocus = useRef({});
  const setRowFocus = (index: number, focus: boolean) => {
    rowFocus.current = { ...rowFocus.current, [index]: focus };
  };  
  
  const getRowSize = (index: number): number => rowSizes.current[index] + GUTTER || 200;
  const getRowFocus = (index: number): number => rowFocus.current[index] || 0.5;

  const nCols = 1;
  const remainingWidth = window.innerWidth - offsetLeft;
  const colWidth = Math.min(392, remainingWidth/nCols);
  const nRows = Math.ceil(content?.length / nCols);
  if (!content) return null; // only render if there is content to render

  return (
    <div 
      className='feed z-10 pl-6'
      style={{position: 'relative', overflow: 'visible', left: offsetLeft, top: 0}}
    >

      <VariableSizeGrid

        ref = {gridRef}
        outerRef = {scrollRef}

        width = {remainingWidth}
        height = {window.innerHeight}
        style={{overflowX: 'visible', overflowY: 'scroll' }}

        columnCount = {nCols}
        columnWidth = {() => colWidth}

        rowCount = {nRows}
        rowHeight = {getRowSize}

        useIsScrolling


        innerElementType = {innerElementType}

        overscanRowCount = {1}

        itemData = {content}
        
      >
        {({ data, columnIndex, rowIndex, style, isScrolling }) => {

          
          const index = rowIndex * nCols + columnIndex
          const content = nCols > 1 ? data[index] : data[rowIndex]

          if (index === 0 || index === data.length - 1) {
            return (
              <div 
                style={{...style, width: colWidth, height: sidebarTop}}
              />
            )
          }

          return (
            <Card 
              content = {content} 
              isScrolling = {isScrolling}
              scrollTo = {scrollTo}
              style = {style} 
              isResizing={isResizing}
              setRowSize = {setRowSize}
              getRowSize = {getRowSize}
              setRowFocus = {setRowFocus}
              getRowFocus = {getRowFocus}
              setSeed = {setSeed}
              ref = {gridRef}
              index = {rowIndex}
              sidebarTop = {sidebarTop}
            />
          )}
        }    
      </VariableSizeGrid>
    </div>
  )
}, );

type Seed = { name: string; kind: string };
type Stream = {
  name: string;
  description?: string;
  seeds: (string | Seed)[];
};

type Filter = {
  name: string;
  isVisible: boolean;
  children?: Filter[];
  count?: number;
};

const sampleStreams: Stream[] = [
  {
    name: 'Trails For Thought',
    description: "Tools we shape and the tools that shape us",
    seeds: [
      { name: 'Alex Xu', kind: 'account' },
      { name: 'Tana Inc.', kind: 'entity' },
    ],
  },
  { name: 'Human In The Loop', seeds: ['Andy Matuschak', 'CMU_HCI'] },
  { name: 'Biochemistry Geeks', seeds: [''] },
];

const useFilters = (): [
  Filter[],
  React.Dispatch<React.SetStateAction<Filter[]>>,
  (filterName: string) => void
] => {
  const [streamFilters, setFilters] = useState<Filter[]>([]);

  const toggleFilters = (filterName: string) => {
    const nextFilters = [...streamFilters];

    const toggle = (filter: Filter) => {
      if (filter.name === filterName) {
        let nextState = !filter.isVisible;
        filter.isVisible = nextState;
        filter.children?.forEach((child) => (child.isVisible = nextState));
      } else if (filter.children) {
        filter.children.forEach((child) => toggle(child));
      }
    };

    nextFilters.forEach((filter) => toggle(filter));

    const updateCounts = (filter: Filter) => {
      if (filter.children?.length) {
        filter.count = filter.children.filter((child) => child.isVisible).reduce((acc, child) => acc + (child.count || 0), 0);
        filter.children.forEach((child) => updateCounts(child));
      }
    };    

    nextFilters.forEach((filter) => updateCounts(filter));

    setFilters(nextFilters);
  };

  return [streamFilters, setFilters, toggleFilters];
};

interface DialogProps {
  chatMessage: {
    content: string;
    time: string;
    role: string;
  };
  className: string;
}

/*interface ChatMessage {
  content: string;
  time: string;
  role: "user" | "assistant";
}*/

const Dialog: React.FC<DialogProps> = ({ chatMessage, className }) => {
  const { content, time, role } = chatMessage;

  const isAssistant = role === "assistant";
  const isUser = role === "user";

  const [isHovered, setHovered] = useState(false);

  return (
    <div
      className={"flex items-baseline gap-1.5 " + className}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className={cn("bg-gray-400/20 flex items-center w-6 h-6 rounded-full cursor-grab", {
          "bg-gray-300/20": isHovered,
        })}
      >
        <div
          className={cn(
            "text-center text-gray-200/95 text-sm leading-5 mx-auto w-5 h-5 rounded-full bg-white/55",
            { "bg-white/95 text-gray-100/95": isHovered }
          )}
        >
          {role[0]}
        </div>
      </div>

      <p
        // wrap text to not overflow
        className={cn(
          "grow transition-all duration-200 py-2 px-1.5 font-light hover:font-normal tracking-wide w-4/5 border-white/0 leading-5 break-words text-gray-100 hover:text-gray-100",
          { "rounded-md pl-4.5 pr-2 py-2 cursor-pointer": isUser },
          { "pl-4.5": isAssistant }
          // {"bg-white/55 border-white/55": isHovered && isUser},
        )}
      >
        {content}
      </p>
    </div>
  );
};

/*interface MessageStreamProps {
  chatHistory: ChatMessage[];
  width: number;
}

const MessageStream = ({ chatHistory, width }: MessageStreamProps): JSX.Element => {
  // measure height of message stream
  const [messageRef, bounds] = useMeasure()

  // force rerender when bounds changes
  const [, setRerender] = useState(0);

  useLayoutEffect(() => {
    setRerender((prev) => prev + 1);
  }, [bounds]);

  console.log(chatHistory.length);

  const sessionHeader =
    chatHistory.length > 1 && (
      <Dialog
        className={cn(
          "sticky top-0 pb-2 border-b border-gray-500",
          { "border-b-0 bg-bg/0 backdrop-blur-none": chatHistory.length < 2 },
          { "backdrop-blur-xl bg-bg/40": chatHistory.length >= 2 }
        )}
        chatMessage={chatHistory[1] || chatHistory[0]}
        key={1}
      />
    );

  const offsetLeft = 30;

  // render a stream of messages
  return (
    <div
      ref={messageRef}
      style={{
        left: -offsetLeft,
        top: -bounds?.height - 16,
        maxHeight: 320,
        width: width + offsetLeft,
      }}
      className="absolute overflow-scroll w-full flex flex-col gap-2"
    >
      {sessionHeader}
      {chatHistory.slice(2, chatHistory.length).map((message, i) => (
        <Dialog chatMessage={message} key={i + 1} />
      ))}
    </div>
  );
};*/

interface ChatInputProps {
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  isLoading: boolean;
}

const ChatInput = ({ input, setInput, isLoading }: ChatInputProps) => {
  const [isFocused, setFocused] = useState(false);

  let Icon = isLoading ? (
    <ImSpinner2 className='w-4 h-4 mx-auto text-gray-400 hover:text-gray-300 animate-spin' />
  ) : input.length > 0 ? (
    <AiOutlineSend className='w-4 h-4 mx-auto text-gray-400 hover:text-gray-300' />
  ) : (
    <div />
  );

  return (
    <>
      <input
        onBlur={() => setFocused(false)}
        onFocus={() => setFocused(true)}
        placeholder='Trailing Through ...'
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className={cn(
          'w-4/5 bg-white/0 text-md placeholder-gray-200 transition-transform duration-300 text-gray-900 placeholder-gray-900/50 focus:outline-none focus:ring-0 text-md font-medium text-gray-100 leading-6',
          { 'placeholder-gray-200/55': isFocused }
        )}
        style={{
          opacity: isFocused ? 1 : 0.35,
        }}
      />
      <button className='shrink rounded-sm w-8 h-8'>{Icon}</button>
    </>
  );
};

interface ChatProps {
  chatHistory: ChatMessage[];
  isLoading: boolean;
  updateHistory: (newMessage: ChatMessage) => void;
  width?: number;
}

const Chat = memo(({ chatHistory, isLoading, updateHistory, width = 256 }: ChatProps) => {
  const [input, setInput] = useState<string>('')
  const [isFocused, setFocused] = useState<boolean>(false)

  const submitRequest = (e: React.FormEvent<HTMLFormElement>) => {
    // prevent submit if input is empty
    e.preventDefault()

    if (input.length > 0) {
      updateHistory({
        time: new Date(),
        content: input,
        role: 'user',
      })

      setInput('')
    }
  }

  const focus = input.length > 0 || isFocused

  // render chat history based on agent input
  return (
    <div className="flex flex-col gap-4" style={{ width }}>
      <MessageStream chatHistory={chatHistory} width={width} />
      <form
        onSubmit={(e) => submitRequest(e)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={
          focus
            ? {
                transform: 'translateX(-2px) translateY(-2px)',
                backgroundColor: `rgb(250 249 250 / 0.55)`,
                borderColor: `rgb(250 249 250 / 0.55)`,
              }
            : {}
        }
        className={cn('flex transition-all duration-200 z-10 justify-between border border-white/10 bg-white/35 rounded-md pl-3.5 pr-2 py-2 resize-none w-full', {
          'bg-white/55 border-white/55 shadow-focus': input.length > 0,
        })}
      >
        <ChatInput isLoading={isLoading} setInput={setInput} input={input} />
      </form>
    </div>
  )
})

export default function Home() {
  return (
    <div></div>
  );
}